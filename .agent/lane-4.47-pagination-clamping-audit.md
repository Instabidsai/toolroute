# Lane 4.47 — Pagination clamping audit (anon list-endpoint DoS)

**Status:** P3 fix shipped. One anon-callable endpoint accepted unclamped `?limit=`. Catalog is small today (~50 tools) so impact is minor; pinned with drift guard so it stays minor as catalog grows.
**Severity:** P3 today (small catalog), P1 once tools/composites/category_beliefs grow into thousands of rows or once any anon-callable list endpoint exposes user-scale data.
**Date:** 2026-04-28
**Sibling lanes:** 4.37/4.38 (body-size DoS), 4.31 (SSRF), 4.30 (IDOR — different class but same "user-supplied integer flowing to a query" surface).

## Threat model

Any list endpoint that reads `?limit=` / `?offset=` / `?page=` / `?days=` from query params and passes the raw value into a Postgres LIMIT/OFFSET (directly or via an RPC `p_limit`) creates two attack surfaces:

1. **Magnitude DoS** — `?limit=999999999` returns the entire table in one response. Burns DB CPU on the LIMIT scan + serialization, burns gateway egress bandwidth, and lets attackers cheaply scrape catalogs that should have been paginated.
2. **NaN coercion** — `?limit=abc` → `parseInt("abc", 10)` returns `NaN`. `Math.min(NaN, max)` returns `NaN`. Postgres receives `LIMIT NaN`, which:
   - Some drivers silently treat as "no limit" (returns everything).
   - Some throw a 22P02 error and 500 the route.
   Either path is undesirable; the first is a stealthier DoS than the magnitude case.

Anon-callable endpoints amplify both: no rate-limit-by-user, no per-key cost accounting, just the global rate limit (and rate limit is still being hardened in Lane 2).

## Findings

### F-1 — `/api/search` accepts unclamped `?limit=` (FIXED)

**File:** `src/app/api/search/route.ts`

Original (line 6-9):
```ts
const limit = parseInt(
  request.nextUrl.searchParams.get("limit") || "10",
  10
);
```

`limit` flows straight to `searchTools(q, limit)` → `supabase.rpc("search_tools_text", { p_query, p_limit: limit })`.

Live probe (toolroute.ai prod, 2026-04-28):
```
$ curl -o /dev/null -w "%{http_code} %{size_download}\n" "https://toolroute.ai/api/search?q=a&limit=999999"
200 42492     # entire matching catalog returned

$ curl -o /dev/null -w "%{http_code} %{size_download}\n" "https://toolroute.ai/api/search?q=a&limit=abc"
200 42492     # NaN treated as unlimited — same body
```

**Fix shipped:** `Number.isFinite()` guard + `Math.min()` clamp at 100, default 10. Also added `q.length > 200` reject to close the long-query DoS sibling (no DB-side cap on tsquery input length).

### F-2 — `/api/v1/usage` clamped magnitude but not NaN (FIXED)

**File:** `src/app/api/v1/usage/route.ts:28-29`

Pattern `Math.min(parseInt(...), 200)` correctly bounded magnitude but `Math.min(NaN, 200) = NaN`, and `offset` was entirely unclamped. Session-authed (lower blast radius — only own data) but still allowed `?offset=999999999` paged-through-nothing DB load.

**Fix shipped:** same `Number.isFinite` + clamp pattern. offset capped at 100,000 (12+ years of usage at 1 row/hour).

### F-3 — `/api/admin/stats` clamped magnitude but not NaN (FIXED)

**File:** `src/app/api/admin/stats/route.ts:21`

Admin-only (validateAdmin gates the route per Lane 4.28), but a NaN `?days=abc` would have constructed `setDate(getDate() - NaN)` → `Invalid Date` → ISO string error → 500. Defense-in-depth.

**Fix shipped:** same pattern.

## Drift guard

`tests/unit/pagination-clamping.test.ts` walks `src/app/api/`. Detection:

1. File contains `searchParams.get("limit"|"offset"|"page"|"page_size"|"per_page"|"days"|"count"|"size")`.
2. AND that param flows into a `parseInt(...)`.
3. AND the file does NOT contain BOTH `Math.min(` (magnitude clamp) AND `Number.isFinite(` (NaN guard).

Failure message includes the exact replacement pattern future authors should use.

## Verification

```bash
npx vitest run tests/unit/pagination-clamping.test.ts
# 1 passed (1)

npx tsc --noEmit
# clean

# Live probe re-run after deploy:
curl -o /dev/null -w "%{http_code} %{size_download}\n" "https://toolroute.ai/api/search?q=a&limit=999999"
# expect: 200 with body matching limit=100, NOT the full catalog
```

## Sibling rules

- Hard Rule #59 (failing-snapshot test as drift TODO).
- Lane 4.37/4.38 (body-size DoS) — same class: anon-controllable input bound that flows to expensive backend operation.
