# Lane 4.134 — admin/* validateAdmin() coverage drift guard

## What this guards

Lane 4.11 extracted `validateAdmin()` (timing-safe header compare).
Lane 4.28 was a one-shot manual audit that confirmed every admin
handler called `validateAdmin()` before doing real work. This lane
ships CI enforcement so a future PR can't silently add a
`src/app/api/admin/<new>/route.ts` that forgets the gate — secret-
header bypass becomes a public-internet admin endpoint the moment
anyone hits it.

## Drift class

```ts
// BUG: forgot the validateAdmin() gate
export async function POST(request: NextRequest) {
  const sb = supabaseAdmin();
  await sb.from("tool_providers").insert(/* request body, unauthed */);
  return NextResponse.json({ ok: true });
}
```

```ts
// BUG: forgot the import
// import { validateAdmin } from "@/lib/admin-auth";  ← deleted
export async function POST(request: NextRequest) {
  // validateAdmin no longer in scope — TS catches THIS one,
  // but the test asserts it explicitly so a `import * as admin`
  // pattern can't sneak past.
}
```

## What the test enforces

Three assertions:

### 1. Sanity: at least one admin route file exists

If the admin directory is ever empty (e.g., refactor moves admin
endpoints elsewhere), the test fails loudly so the lane gets
re-targeted, not silently passing on zero files.

### 2. Every admin route file imports validateAdmin from @/lib/admin-auth

Regex:
```ts
/import\s*\{[^}]*\bvalidateAdmin\b[^}]*\}\s*from\s*["']@\/lib\/admin-auth["']/
```

Catches missing imports AND alternate import paths
(e.g., `import { validateAdmin } from "../../../lib/admin-auth"` —
fails because the path doesn't match). Forces the canonical
`@/lib/admin-auth` import.

### 3. Every exported HTTP method handler calls validateAdmin(

For each `export async function (GET|POST|PATCH|PUT|DELETE)(...)`,
extract the function body (matched-brace depth counter, string-aware
to skip `{`/`}` inside strings/templates), then assert
`/\bvalidateAdmin\s*\(/` matches inside the body.

**Why method-handler-body scope, not file-level?** A file can
export `GET` (read-only, sometimes no auth needed by design)
plus `POST` (mutating, must auth). File-level scope can't
distinguish; handler-body scope can. We require validateAdmin
on EVERY exported HTTP method handler, since admin/* by
convention gates the whole subtree.

**Why not require validateAdmin be FIRST in the body?** Lane
4.106 gated `admin/providers` POST behind
`ENABLE_TOOL_PROVIDERS_ADMIN=1` with a 410 Gone return BEFORE
validateAdmin runs (intentional — public 410 instead of 401
when the feature is disabled). A "first call" assertion would
have flagged it as a regression. As long as validateAdmin is
reachable on every code path that does real work, the
preceding feature flag check is fine.

## Source-file regex parser

Memory rule #59 hygiene — never `import` runtime modules in
tests, they pull in `createClient()` and crash without prod env.
All assertions use `readFileSync` + regex over source text.
Comment-strip pass (block + line) before regex check so JSDoc
references like `// validateAdmin()` in a code example don't
false-positive.

## Brace-matching body extractor

`extractHandlerBody(src, method)` returns the text between the
opening `{` after the function signature and its matched closing
`}`. Tracks string/template literals so `{`/`}` inside strings
don't throw off the depth counter. Returns `null` if the method
isn't exported by the file (skip-if-absent — a route exporting
only GET shouldn't fail because POST is missing).

## Coverage matrix (post Lane 4.134)

| Drift class | Guard |
|---|---|
| Service-role JWT in source | Lane 4.26 + 4.132 |
| supabaseAdmin() in lib helper | Lane 4.132 |
| RPC-callable mint surface | Lane 4.131 |
| Sensitive column WRITE drift | Lanes 4.121–4.130 |
| Sensitive table READ drift (IDOR) | Lane 4.133 |
| Route missing auth class | Lane 4.33 + 4.116 |
| Webhook signature bypass | Lane 4.20 + 4.29 |
| Admin route missing validateAdmin gate | **Lane 4.134 (this lane)** |

Every admin/route/RPC/lib/webhook surface is now CI-gated.
