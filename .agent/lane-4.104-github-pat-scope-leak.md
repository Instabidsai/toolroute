# Lane 4.104 — github master-pool PAT silently leaks private repos via "public" operations; refines Lane 4.102 Class-C

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** HIGH-LATENT (`GITHUB_TOKEN` not set in Vercel prod per Lane 4.100 inventory; latent until set)
**Sibling:** Lane 4.102 (broken-by-design Class-A) → **Lane 4.104 (Class-C github correction)**

## TL;DR

Lane 4.102 classified `github` as Class-C ("public-data, rate-limit-uplift only"). **That's wrong** for a personal access token (PAT) with private-repo scope — the `search-repos`, `get-readme`, and `list-issues` operations all return content visible to the token, including private repos.

**Refinement to Class-C taxonomy:** the data-scope of "public-data" providers is **token-scope-dependent**, not service-dependent. A safe Class-C requires both:
1. The upstream service operations are inherently public-data, AND
2. The master-pool credential is scoped to public-data only.

GitHub fails (2): there's no enforcement that `GITHUB_TOKEN` must be a fine-grained PAT with `public_repo`-only scope. The adapter has no defensive filter against private-content responses. Whatever scope the token holds, the response inherits.

## File:line evidence

### `src/lib/adapters/github-adapter.ts:5-15`
```typescript
function getHeaders(byokKey?: string): Record<string, string> {
  const token = byokKey || process.env.GITHUB_TOKEN || null;
  ...
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
```

### `search-repos` (lines 32-82)
User passes `query` directly to GitHub API. **GitHub docs (REST API search):** "When you use this endpoint with a personal access token, the result will include private repositories that the user has access to, in addition to public repositories." Master-pool token → ToolRoute's bot/user account → private repos in result set.

### `get-readme` (lines 84-133)
User passes `owner`, `repo`. No visibility check before fetching `/repos/{owner}/{repo}/readme`. If owner=Instabidsai and repo=`<some-private-repo>`, the token's access decides whether it returns the README. Master-pool token with private-repo access = README content of a private repo returned to the API caller.

### `list-issues` (lines 135-191)
Same shape — passes through `owner`/`repo`. Issues visible only to the token are returned.

## Concrete leak scenarios

**Scenario A — search-repos enumeration**
User calls `tool:"github",op:"search-repos",input:{query:"org:Instabidsai language:typescript"}`. Master-pool token = ToolRoute's GitHub user/bot. Response includes private Instabidsai repos. Leaks: repo names, descriptions, primary language, recent activity.

**Scenario B — get-readme content extraction**
User guesses or learns a private repo name (via Scenario A), calls `tool:"github",op:"get-readme",input:{owner:"Instabidsai",repo:"<priv>"}`. Returns README content (often containing setup docs, internal architecture, secrets-in-prose).

**Scenario C — issue body extraction**
User calls `list-issues` for a private repo. Returns issue titles, comment counts, label assignments — exposes incident handling, security discussions, internal user info.

## Why this is independent of GitHub's ToS resale ban (Lane 6.13)

Lane 6.13 found GitHub `forbidden` via §H "subscription-based access" prohibiting resale. **Different layer:** §H operates on the **service-as-resold** angle (regardless of data shape). Lane 4.104 operates on the **data-leak via master-pool token** angle (regardless of resale legality). Both layers fail; either is sufficient grounds to gate.

## Verification status

- [x] Adapter source confirms no visibility filter (`src/lib/adapters/github-adapter.ts:32-191`).
- [x] GitHub REST API docs cited for search behavior with PAT.
- [ ] **NOT verified:** the actual scope of `GITHUB_TOKEN` if it gets set in prod. Could be:
  - **Best case:** fine-grained PAT, public_repo-only → only Class-C COGS/quota leak
  - **Worst case:** classic PAT with `repo` scope → Class-A private repo leak per scenarios A-C
  - **Catastrophic case:** classic PAT with `repo, admin:org` → can ENUMERATE all org repos including private

The adapter cannot tell the difference at runtime. It just trusts the token.

## Mitigation options

### Option 1 — Defensive scope check in adapter (cheap)
Add a one-time scope-check on adapter init: `GET /user` returns `X-OAuth-Scopes` header listing token scopes. Refuse to use the token if it has any of `repo`, `admin:org`, `admin:repo_hook`. Only allow `public_repo` and lesser scopes. Fails fast at startup if env var is misconfigured.

### Option 2 — Switch to GitHub App (proper)
Use GitHub App installation instead of PAT. Per-installation tokens are scoped to the installation's repos. Requires more wiring (app creation, JWT signing, installation token exchange) but eliminates ambient-scope class.

### Option 3 — BYOK-only (simplest)
Match Lane 4.100 / Codex #23 — github goes in `BYOK_REQUIRED_SLUGS`. Already classified as `forbidden` per Lane 6.13. With the BYOK gate, master-pool fall-through never fires, so token-scope is irrelevant. **Recommended.**

## Class-C taxonomy refinement (extends Lane 4.102)

Lane 4.102's Class-C ("public-data, rate-limit-uplift only") stands as a logical class but the **eligibility condition is token-scope, not service nature.** Restated:

> Class-C eligibility: (a) operations target public-data resources of the upstream service AND (b) the master-pool credential is verifiably scoped such that no operation can return private/account-scoped data even by the credential-holder's intent.

By that condition:
- `dataforseo`: passes — credentials are SEO query auth; operations (serp/keywords/backlinks) return query results, no account-state hidden in response. Class-C confirmed (verified by reading adapter).
- `outscraper`: status unverified in this lane; needs same check.
- `github`: **fails (b)** — token scope undefined; adapter trusts token. **Re-classified as Class-A-like-via-scope-ambient.**

So Class-C drops from 3 adapters to 2 (dataforseo + outscraper-pending), and github joins the Class-A list (now 13 adapters). Lane 4.102's structural rule extends:

> "No Class-A master-pool env var (now 13 listed) gets set in prod until the BYOK gate ships AND `GITHUB_TOKEN` (if ever set) is verified as a fine-grained PAT scoped to public_repo at most."

## Acceptance for this audit memo

- [x] github adapter source read in full — no visibility filter on search-repos/get-readme/list-issues
- [x] GitHub REST API docs cited for PAT-search behavior
- [x] dataforseo adapter cross-checked — passes Class-C eligibility (no token-scope ambient leak)
- [x] outscraper status flagged for follow-up (not read in this lane)
- [x] Class-C taxonomy refined with token-scope-eligibility condition
- [x] github moved from Class-C to Class-A (13-adapter list extension)
- [ ] Codex: ticket #23 BYOK_REQUIRED_SLUGS extended to ensure github is in the list (already implied by Lane 6.13 forbidden classification)
- [ ] Codex (separate): defensive `GET /user` scope-check on adapter init OR switch to GitHub App OR enforce BYOK-only

## Why this matters for /loop directive

The /loop goal is "production-ready financial gateway." A "public-data" classification that's actually token-scope-dependent is the kind of taxonomy fault that makes a launch-readiness checklist self-deceiving. This memo corrects the Class-C entry for github before the env var gets set ad-hoc and the leak goes live.
