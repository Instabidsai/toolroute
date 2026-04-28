# Lane 4.32 — Hardcoded credential audit

**Status:** CLEAN + drift test shipped
**Severity if exploited:** P0 if hit (credential disclosure → full account takeover, fund drain)
**Audited:** `src/`, `mcp-server/`, `tests/`, `scripts/` (excludes `node_modules/`, `.next/`, `.git/`, `.vercel/`)

## Why this audit

Memory rule #54 documents the recurring "showcase-page hardcoded JWT" pattern: pages like `/bounty`, `/leaderboard`, `/benchmarks` ship with a hardcoded `const SUPABASE_SR = "eyJ..."` at file top for build-time fetch, exposing service-role credentials in the client bundle. VibeArmor (sibling product) shipped two such pages in late April 2026.

Beyond JWTs, the same risk class covers Stripe live keys, OpenAI/Anthropic API keys, AWS access keys, and GitHub tokens — anything where a single grep would catch a recurring class of high-impact leaks.

ToolRoute has **no pre-commit hook, no husky, no lint-staged, no gitleaks, no trufflehog** (verified via `package.json` + glob of dotfiles). The only credential gate is human review on every PR. That's not a gate — that's a hope.

## Audit method

Grepped repo for these patterns:

| Pattern | Regex | Min entropy |
|---------|-------|-------------|
| JWT | `eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` | 3 segments × 10 chars |
| OpenAI sk-proj | `sk-proj-[A-Za-z0-9_-]{40,}` | 40 chars after prefix |
| Anthropic sk-ant | `sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{40,}` | 40 chars |
| Stripe webhook secret | `whsec_[A-Za-z0-9]{32,}` | 32 chars |
| Stripe live secret | `sk_live_[A-Za-z0-9]{24,}` | 24 chars |
| Stripe restricted live | `rk_live_[A-Za-z0-9]{24,}` | 24 chars |
| AWS access key id | `AKIA[0-9A-Z]{16}` | exactly 16 chars |
| GitHub PAT (classic) | `ghp_[A-Za-z0-9]{36,}` | 36 chars |
| GitHub server-to-server | `ghs_[A-Za-z0-9]{36,}` | 36 chars |
| GitHub OAuth user | `gho_[A-Za-z0-9]{36,}` | 36 chars |

Each hit is then filtered against documentation-placeholder markers (`your-`, `your_`, `...`, `xxx`, `XXX`, `REPLACE`, `EXAMPLE`, `<your`, `PLACEHOLDER`).

## Findings

### F-1: ToolRoute Supabase anon JWT in `mcp-server/index.js:12` — INTENTIONAL, allowlisted

```js
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIs...";
```

The MCP server ships to end-users via npx (`mcp-server/` builds an npm package consumed by Claude Desktop / Cursor / etc.). Anon key being public is intentional — RLS on the registry tables (`tools`, `tool_categories`, `category_beliefs`) is what enforces read-only/owner-scoped access. All write paths go through the api-key-gated HTTPS gateway (per the comment at L9-10).

**Status:** allowlisted in `PUBLIC_ALLOWLIST` in `tests/unit/hardcoded-credentials.test.ts`. The test asserts the allowlisted value still appears in the source — if mcp-server rotates its anon key without updating the allowlist, the test catches it.

This is an explicit, file-level, single-source-of-truth allowlist decision. Adding to the allowlist is a load-bearing change reviewers must approve.

### F-2: Documentation placeholders in blog posts — IGNORED

| File | Line | Pattern | Value |
|------|------|---------|-------|
| `src/app/blog/bring-your-own-key-mcp-byok/page.tsx` | 150 | OpenAI sk-proj | `sk-proj-your-openai-key...` |
| `src/app/blog/bring-your-own-key-mcp-byok/page.tsx` | 178 | Stripe sk_live | `sk_live_your-stripe-key...` |
| `src/app/blog/shadow-mcp-risks/page.tsx` | 445-446 | GitHub ghp + Stripe sk_live | `ghp_...`, `sk_live_...` |
| `tests/unit/setup-payment-route.test.ts` | 60 | Stripe sk_test | `sk_test_123` |

All four are under 24 chars of entropy after the prefix and contain `your-` / `...`, so the placeholder filter removes them. No real credentials.

### F-3: Everywhere else — CLEAN

Every other matching pattern in the source tree was either:
- A documentation example with a placeholder marker (filtered)
- The `PUBLIC_ALLOWLIST` JWT (allowlisted)
- The regex source in this very test file (assembled from string parts so the test file doesn't self-flag)

## Drift-prevention test

`tests/unit/hardcoded-credentials.test.ts` — 3 tests, all pass:

1. **Main scan** — walks `src/`, `mcp-server/`, `tests/`, `scripts/` and applies all 10 patterns. Filters allowlisted values + placeholder markers. Fails with a per-hit report showing file/line/excerpt if any real credential is committed.
2. **Allowlist sanity** — asserts the canonical anon JWT is still present in `mcp-server/index.js`. If mcp-server rotates its anon key without updating the allowlist, this catches the drift before the main scan starts silently flagging the new key.
3. **Placeholder filter unit test** — sanity-checks `isPlaceholder()` against known placeholder + non-placeholder shapes.

Failure mode (when a real credential lands):
```
1 hardcoded credential hit(s) found:
  src/app/api/v1/some-route/route.ts:42  [Stripe sk_live]
    const stripe = new Stripe("sk_live_AbCdEf123...");

If the value is intentionally public (e.g. an anon JWT for a client-side MCP server),
add it to PUBLIC_ALLOWLIST in this file. Otherwise, move the credential to env
(.env.local for dev, vercel env add for prod) and import via process.env.
```

## What this test does NOT catch

- **Credentials in non-source files** — `.env.local` is not scanned (it's not committed). `.next/` and `node_modules/` are excluded by walk filter.
- **Lower-entropy custom secret formats** — proprietary token shapes that don't match the patterns. Add new patterns when discovered.
- **Credentials encoded/obfuscated** — base64'd JWTs, hex-escaped keys, etc. Out of scope; gitleaks/trufflehog do this better.
- **Credentials in commit history** — only scans HEAD. Any leaked secret already in git history needs rotation regardless.

This is a **gate against new commits**, not a forensic audit. Combined with quarterly reviews of the allowlist and `git log --all -p | gitleaks` for history scrubs, it's enough.

## Cross-applies

- **VibeArmor** — already shipped 2 hardcoded service-role JWTs in showcase pages (memory rule #54). This test pattern lifts directly.
- **CallTwin** — Twilio `AC...` account SIDs + auth tokens often hardcoded in dev. Add Twilio pattern when porting.
- **DropClose** — Vapi keys, ElevenLabs keys; lift the test, add patterns.
- **AffixedAI / PureUSPeptide2 / PeptideAI / GTM-Hub / JarvisCRM** — same story. Multi-product secrets-scanner pattern; this test is the canonical implementation to copy.

## Recommendations (deferred — not blocking)

- **R-1 (P3):** Add gitleaks pre-commit hook. The vitest runs in CI, but a local hook catches secrets before they hit the remote at all. ~5 min setup with `husky` + `gitleaks`.
- **R-2 (P3):** Extend patterns to cover OpenAI legacy `sk-` (no `proj-` prefix), Slack `xox[abp]-...`, Twilio `AC[a-f0-9]{32}` + auth token, Vapi keys.
- **R-3 (P3):** Run `gitleaks detect --source . --log-opts="--all"` once for historical sweep. Anything that turns up needs rotation, not just removal.

## Sibling lanes

- 4.12 (provider master & BYOK key leak-class audit, CLEAN) — covered runtime key handling; this lane covers compile-time/source-tree leaks
- 4.18 (redactCreds() helper, shipped) — defense-in-depth for credentials that DO escape into logs
- 4.26 (service-role JWT bundle exposure, CLEAN) — covered server-only imports; this lane covers source-tree hardcodes
