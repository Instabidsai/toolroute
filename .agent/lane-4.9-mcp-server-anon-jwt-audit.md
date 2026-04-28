# Lane 4.9 — mcp-server hardcoded anon JWT audit

**Status:** AUDIT — clean finding for `src/`, one intentional case in `mcp-server/`, one Hard Rule #58 risk to verify pre-Lane-0.1.
**Owner:** Claude (Lane 4)
**Hard Rule cross-refs:** #54 (showcase-page hardcoded JWT class), #56 (anon-read 200+[] is AMBIGUOUS), #58 (anon-client server-component reads silently break post-RLS-lockdown)

## TL;DR

ToolRoute is **clean of Hard Rule #54** in the high-risk surface (`src/app/*` Server Components). One hardcoded Supabase anon JWT exists in `mcp-server/index.js`, but it is **public-by-design** — used for read-only RPC calls that any anonymous Supabase client could already make. Recommendation: keep the JWT but add an `process.env.SUPABASE_ANON_KEY ?? "<fallback>"` pattern + redirect `librarian_status` through the HTTPS gateway to neutralize Hard Rule #58 risk after Lane 0.1 RLS lockdown.

## Audit method

```
grep -rE 'eyJ[A-Za-z0-9_-]{30,}\.' src/
grep -rE 'eyJ[A-Za-z0-9_-]{30,}\.' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=.agent .
grep -rE '(sk-[A-Za-z0-9]{20,}|SG\.[A-Za-z0-9_-]{20,}|sk_(live|test)_)' src/
```

## Findings

### Finding 1: src/ is clean of Hard Rule #54 (CONFIRMED CLEAN)

**Result:** Zero hardcoded JWTs in `src/app/*`, `src/lib/*`, `src/components/*`. The pattern that bit VibeArmor (`/bounty`, `/benchmarks`, `/leaderboard` Server Components shipping `const SUPABASE_SR = "eyJ..."` at file top) is **not present** in ToolRoute.

This matters because:
- ToolRoute has **showcase pages** that fit the same vulnerable pattern: `/discover`, `/tools`, `/tools/[slug]`, `/agents`, blog posts. None of them ship hardcoded JWTs.
- Lane 4.6 (PR #20) and Lane 4.7 (PR #22) audited Supabase client usage in Server Components — they correctly use the public anon `supabase` client from `src/lib/supabase.ts` which loads from `process.env.NEXT_PUBLIC_SUPABASE_*`.
- The `/blog/bring-your-own-key-mcp-byok` and `/blog/shadow-mcp-risks` pages contain `sk_live_your-stripe-key` and `STRIPE_KEY: sk_live_...` strings, but these are **placeholder examples in code blocks**, not real keys. Confirmed by inspection.

**Verdict:** No action required for `src/`. Per Hard Rule #56, this is now a confirmed-LOCKED reading (not 200+[] AMBIGUOUS), since the audit was a structural grep, not a probe of empty tables.

### Finding 2: mcp-server/index.js hardcoded anon JWT (INTENTIONAL, document-and-harden)

**Location:** `mcp-server/index.js:11-12`
**JWT role:** `anon` (decoded payload: `{"role":"anon"}`)
**Comment in file:** `// Public anon key — read-only. All write paths now go through the api-key-gated HTTPS gateway`

**Usage:** This anon JWT is used for 4 read-only RPC calls:
- `check_before_build` (line 82) — registry search
- `search_tools_text` (line 102) — text search over tools
- `get_category_champion` (line 129) — category brain query
- `librarian_startup` (line 147) — system status (tool count, beliefs, usage_events_7d)

The other 4 mcp-server tools (`record_usage`, `challenge_tool`, `log_tool_request`, `execute`) bypass this JWT entirely and route through `gatewayPost()` with a Bearer API key against `${TOOLROUTE_BASE_URL}/api/v1/registry/*` — the gateway uses `supabaseAdmin()` (service role) server-side after API-key validation.

**Why this is NOT a Hard Rule #54 violation:**
1. The JWT is `role=anon`, which is **public-by-design**. It is the same key any browser visiting toolroute.ai loads via `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. The mcp-server ships to npm as `@toolroute/mcp-server`. End-users install it, run it locally, and need *some* way to make registry RPC calls. Loading the same anon JWT from env would just push this responsibility to every customer's `.env`.
3. RLS policies on registry tables (`tools`, `category_beliefs`, `composites`) already gate what the anon role can read. The JWT does not bypass those policies.

**But it's still worth hardening:**
- Style/audit: external code reviewers will keep flagging this on every audit. A `process.env.SUPABASE_ANON_KEY ?? "<fallback>"` pattern documents intent and quiets reviewers.
- Operational: if Supabase rotates the project's anon key (rare but possible — e.g., after a forced rotation incident), every npm-installed mcp-server is broken until a new package version is published. Env override is a one-line escape hatch.
- Forward-compat: if ToolRoute ever splits brain into a separate Supabase project, the override path is already in place.

**Recommended patch:**
```js
// mcp-server/index.js
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://isbratmfnnzipzyoefbo.supabase.co";
// Public anon key — read-only. All write paths route through the api-key-gated
// HTTPS gateway (see TOOLROUTE_BASE_URL/api/v1/registry/*).
// Env override available for ops flexibility (anon-key rotation, brain split).
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYnJhdG1mbm56aXB6eW9lZmJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY0MTYsImV4cCI6MjA5MDIxMjQxNn0.GI565bgr2HCQfeRYMVrTUyB2gUlncdb6mx-DEoL9_Fs";
```

### Finding 3: librarian_startup RPC may break after Lane 0.1 lockdown (HARD RULE #58 RISK — VERIFY)

**The risk:** After Justin runs `scripts/lockdown-anon-read-leaks.sql` (Lane 0.1), `usage_events` rows are owner-scoped (anon SELECT returns 0 rows). The mcp-server's `librarian_status` tool calls the `librarian_startup` RPC, which based on the startup display in `~/.claude-jarvis/skills/toolroute/SKILL.md` should return:

```
Usage (7d): {usage_events_7d}
```

**Two scenarios:**
1. **`librarian_startup` is `SECURITY DEFINER`** → RLS bypassed inside the function. `usage_events_7d` count stays correct. **No action needed.** This is the typical pattern for read-only registry RPCs.
2. **`librarian_startup` is `SECURITY INVOKER` (default)** → Anon's RLS enforced. `usage_events_7d` silently returns 0. **Hard Rule #58 hit.** Per the rule, server components reading anon → `[]` after RLS lockdown produce no error, no log, no page.

**Verification step (cannot do from this audit pass):**
```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('librarian_startup', 'check_before_build', 'search_tools_text', 'get_category_champion');
```
- `prosecdef = true` → SECURITY DEFINER → safe.
- `prosecdef = false` → SECURITY INVOKER → must either:
  - **A.** Convert RPC to `SECURITY DEFINER` (one-line `ALTER FUNCTION ... SECURITY DEFINER` migration).
  - **B.** Redirect mcp-server's `librarian_status` tool through the HTTPS gateway (where service role bypasses RLS naturally).

**Sequencing:** This verification should happen **before** Lane 0.1 SQL ships, so any required `ALTER FUNCTION` migration is bundled with the lockdown SQL. Otherwise mcp-server users see silently degraded data for the lockdown→fix gap.

## Defensive vitest (regression guard)

```ts
// tests/audit/no-hardcoded-jwt.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const JWT_REGEX = /eyJ[A-Za-z0-9_-]{30,}\./g;
const ALLOWED_FILES = new Set([
  "mcp-server/index.js",  // intentional anon JWT — Lane 4.9 documented
]);

function* walkFiles(dir: string, root = dir): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const rel = full.slice(root.length + 1).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) yield* walkFiles(full, root);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) yield rel;
  }
}

describe("Hard Rule #54 — no hardcoded Supabase JWTs in source", () => {
  it("rejects any new file with eyJ* JWT pattern", () => {
    const offenders: string[] = [];
    for (const rel of walkFiles(process.cwd())) {
      if (ALLOWED_FILES.has(rel)) continue;
      const body = readFileSync(rel, "utf-8");
      if (JWT_REGEX.test(body)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("verifies the only allowed JWT (mcp-server/index.js) is role=anon", () => {
    const body = readFileSync("mcp-server/index.js", "utf-8");
    const match = body.match(/eyJ[A-Za-z0-9_-]+\.eyJ([A-Za-z0-9_-]+)\./);
    expect(match).not.toBeNull();
    const payload = JSON.parse(
      Buffer.from(match![1], "base64url").toString("utf-8")
    );
    expect(payload.role).toBe("anon");
  });
});
```

This guard:
1. Fails any new commit that introduces a hardcoded JWT outside the allowlist.
2. Asserts the existing one is `role=anon` (catches accidental service-role leak in the same line).
3. Lives next to the Lane 6.4.4 drift-prevention test (`MARKETING_DRIFT_BASELINE`) — same shape, different finding class.

## Decisions queued

### D13. Apply the env-override patch to mcp-server?
- **A.** Yes, ship now (one-file change, zero behavior change for users without env var, audit-clean for reviewers).
- **B.** Defer until next mcp-server version bump.

### D14. Run the SECURITY DEFINER verification before Lane 0.1 ships?
- **A.** Yes — verification SQL is one query, the fix (if needed) is one `ALTER FUNCTION` line. Bundle with lockdown SQL.
- **B.** Ship Lane 0.1 first, verify mcp-server behavior post-deploy, fix on observed regression.

Recommend **D13.A + D14.A** — both are cheap and remove ambiguity.

## Cross-references

- Lane 4.6 (`.agent/lane-4.6-server-only-sensitive-reads.md`, PR #20) — anon-client → service-role migration for sensitive tables
- Lane 4.7 (`.agent/lane-4.7-comprehensive-anon-read-audit.md`, PR #22) — broad anon-read audit, code-ready for Lane 0.1
- Hard Rule #54 — showcase-page hardcoded JWT class (VibeArmor self-own pattern)
- Hard Rule #56 — anon-read 200+[] AMBIGUOUS vs LOCKED (three-state probe)
- Hard Rule #58 — anon-client reads in server components silently break post-RLS-lockdown
- `mcp-server/index.js:11-12` — the one intentional case
- `scripts/lockdown-anon-read-leaks.sql` (Lane 0.1) — Justin to run; ALTER FUNCTION migration may need to bundle here

## Closing note

Pre-launch security posture for ToolRoute hardcoded-credential class is **strong**. The one hardcoded JWT in source is a public-by-design key with a clean separation between read-only RPCs (anon path) and write-gated operations (HTTPS gateway with service-role server-side). The remaining work is two cheap hardening moves (D13 env-override, D14 SECURITY DEFINER verification) and one regression-guard test, all bundleable into a single PR if Justin OKs.
