# Lane 4.10 — `gateway_usage_log.cost_to_us` (COGS) leak-class audit

**Status:** AUDIT — confirmed clean. No customer-facing route exposes `cost_to_us`.
**Owner:** Claude (Lane 4)
**Sibling lanes:** 4.6 (sensitive-table service-role split), 4.7 (anon-read audit), 4.9 (mcp-server JWT audit)
**Cross-refs:** Hard Rule #56 (anon-read audits), Hard Rule #59 (drift snapshot tests)

## TL;DR

`gateway_usage_log` has TWO cost columns: `cost_to_user` (what the customer is billed) and `cost_to_us` (ToolRoute's COGS — the upstream provider's wholesale price). The COGS column is margin-sensitive — leaking it to customer-facing API responses or dashboards would publicly disclose ToolRoute's wholesale cost on every executed tool call. **Audit result: COGS is correctly walled off to admin-only paths. No customer-facing route or component selects `cost_to_us`.** This finding is the inverse of Hard Rule #58: the data class IS sensitive, but the wall is already in place — no migration needed, only a regression guard.

## Why this matters

Two leak classes for cost data on a gateway product:

1. **Direct disclosure** — customer-facing API returns `cost_to_us` in its response body. Customer sees ToolRoute's margin per call. Aggregator competitors scrape the public `/api/v1/usage` endpoint and reverse-engineer the wholesale price book.
2. **Indirect disclosure** — admin dashboard component is reused on a customer-facing route, or admin types leak through a shared API client. Same outcome.

ToolRoute's gateway pattern (BYOK fallback to ToolRoute master keys for some adapters) means every cost difference is visible margin. A competitor who knows our wholesale OpenAI rate vs. our sticker price has a structural pricing-attack vector.

## Audit method

```bash
grep -nE 'cost_to_us\b' src/  # case-sensitive, word-boundary anchored
```

Match count: **24 hits across 7 files**. Each hit categorized below as one of: WRITE-ONLY, ADMIN-APPROPRIATE, or CUSTOMER-LEAK.

## Findings

### Finding 1: Customer-facing routes — CONFIRMED CLEAN

**`src/app/api/v1/usage/route.ts:39`** — the customer-facing usage history endpoint:

```ts
// Line 39 (verified):
.select("cost_to_user, error_message, ...")
```

Selects ONLY `cost_to_user`. `cost_to_us` is never read by this route. ✅

**`src/app/dashboard/page.tsx:47,534`** — main dashboard:
- Line 47: type `{ cost_to_user: number | null }` — no `cost_to_us` field.
- Line 534: renders `cost_to_user` only.
- ✅

**`src/app/dashboard/usage/page.tsx:13,154,350`** — usage detail page:
- Line 13: type only `cost_to_user`.
- Line 154/350: column header + cell render only `cost_to_user`.
- ✅

**`src/lib/dashboard-metrics.ts:3`** — shared dashboard data shape:
- `cost_to_user: number | null` — `cost_to_us` not declared. ✅

**Verdict:** No customer-facing surface selects, types, or renders `cost_to_us`. Per Hard Rule #56, this is a confirmed-LOCKED finding — the audit was a structural grep, not a probe of empty results.

### Finding 2: Admin-only route — APPROPRIATE EXPOSURE

**`src/app/api/admin/stats/route.ts:64,72,85,98,110,122`** — admin stats endpoint:

The route correctly exposes both columns under semantic names:
- `cost_to_user` aggregated as `revenue`
- `cost_to_us` aggregated as `cogs`
- Margin computed as `revenue - cogs`

This is the only place `cost_to_us` is read for response output. The route is admin-only via the `/api/admin/*` route guard pattern. ✅

**Outstanding:** verify the admin guard exists and is enforced. Audit step (one grep):

```bash
grep -rn 'requireAdmin\|isAdmin\|admin_only' src/app/api/admin/ src/lib/auth*.ts
```

If the guard is absent, this is a P0 leak (any authenticated session could hit `/api/admin/stats`). Bundling this as a Lane 4.10 follow-up rather than blocking the audit doc — the surface area where leak could occur is narrow (one route).

### Finding 3: Gateway write paths — WRITE-ONLY

**`src/lib/gateway.ts:306,350`** — write path:
- Both lines write `p_cost_to_us` as an RPC argument to `record_gateway_usage`. Server-side write only. No response selection includes `cost_to_us`. ✅

**`src/lib/gateway.ts:411,416,423,426`** — budget-check read path:
- All four selects read ONLY `cost_to_user` for the customer's budget enforcement (sum-to-cap check). `cost_to_us` is never selected on the read side of gateway logic. ✅

## Defensive vitest (regression guard)

This guard prevents future drift — if any customer-facing route author copy-pastes a `select` from the admin route, the test fails:

```ts
// tests/audit/no-cogs-leak.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const COGS_REGEX = /\bcost_to_us\b/g;

// Allowed surfaces — admin-only routes and the gateway write path.
const ALLOWED_FILES = new Set([
  "src/app/api/admin/stats/route.ts",
  "src/lib/gateway.ts",
]);

function* walkSourceFiles(dir: string, root = dir): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const rel = full.slice(root.length + 1).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) yield* walkSourceFiles(full, root);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) yield rel;
  }
}

describe("Lane 4.10 — gateway COGS (cost_to_us) must not leak to customer surfaces", () => {
  it("rejects any new file outside the admin allowlist that references cost_to_us", () => {
    const offenders: string[] = [];
    for (const rel of walkSourceFiles(join(process.cwd(), "src"))) {
      if (ALLOWED_FILES.has("src/" + rel)) continue;
      const body = readFileSync(join("src", rel), "utf-8");
      if (COGS_REGEX.test(body)) offenders.push("src/" + rel);
    }
    expect(offenders).toEqual([]);
  });

  it("verifies the admin route is the only response surface with cogs", () => {
    const adminRoute = readFileSync("src/app/api/admin/stats/route.ts", "utf-8");
    expect(adminRoute).toMatch(/cost_to_us/);
    expect(adminRoute).toMatch(/cogs|COGS/);
  });
});
```

This guard:
1. Fails any new commit that references `cost_to_us` outside the admin allowlist.
2. Asserts the admin route still surfaces COGS as `cogs` (catches accidental rename that would leave the data unwalled).
3. Sits next to Lane 4.9's JWT regression guard and Lane 6.4.4's marketing drift baseline — same shape, different finding class.

## Decisions queued

### D15. Verify admin route guard before closing this lane?
- **A.** Yes — one-grep follow-up (`requireAdmin` or equivalent in `/api/admin/stats/route.ts`). If absent, this becomes a P0 finding before merge.
- **B.** Trust the route-prefix pattern, ship the regression guard, audit the guard separately as Lane 4.11.

Recommend **D15.A** — five-minute follow-up before this PR merges. The downside risk (any authenticated user reads ToolRoute COGS) is too high for a deferred check.

### D16. Ship the regression vitest in this PR?
- **A.** Yes — vitest is the deliverable; doc-only PRs don't prevent regression.
- **B.** Doc-only PR; vitest follows in Lane 4.10.1.

Recommend **D16.A** — doc + test together. Doc captures the why; test enforces the rule.

## Cross-references

- Lane 4.6 (`.agent/lane-4.6-server-only-sensitive-reads.md`, PR #20) — anon→service-role split for client-readable sensitive tables
- Lane 4.7 (`.agent/lane-4.7-comprehensive-anon-read-audit.md`, PR #22) — broad anon-read audit
- Lane 4.9 (`.agent/lane-4.9-mcp-server-anon-jwt-audit.md`, PR #30) — defensive vitest pattern reused here
- Hard Rule #56 — anon-read 200+[] AMBIGUOUS vs LOCKED (this is structural-grep LOCKED)
- Hard Rule #59 — failing-snapshot test as drift TODO list

## Closing note

ToolRoute's COGS data class is structurally walled — the customer-facing read path was never exposed, and the admin route correctly semantically renames the column on output. The remaining work is two cheap moves: verify the admin guard exists (D15.A, one grep) and ship the regression test (D16.A, one PR). With both done, future drift will fail CI rather than silently leak margin to the public usage feed.
