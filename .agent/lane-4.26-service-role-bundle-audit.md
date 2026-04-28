# Lane 4.26 — Service-Role JWT Bundle Exposure Audit

**Status:** CLEAN at file scope. No leak today. Defensive marker (`server-only`) recommended as P3 follow-up.
**Severity:** P0 if found exploitable (service_role grants schema-wide write).
**Date:** 2026-04-28
**Sibling rules:** Memory rule #54 (showcase-page hardcoded-JWT pattern), rule #58 (anon-client in server components).

## Why this audit class

`SUPABASE_SERVICE_ROLE_KEY` is the master key — bypasses RLS, owns every table, can mint admin sessions. Three exposure paths to audit on every Supabase + Next.js app:

1. **Hardcoded JWT** — `const KEY = "eyJ..."` inline in any file under `src/`. Per memory #54, this happens on showcase / leaderboard / bounty-style server components frequently. Build inlines it; sourcemaps expose it.
2. **`process.env.SUPABASE_SERVICE_ROLE_KEY` in a `"use client"` file** — Next.js silently strips non-`NEXT_PUBLIC_*` env vars from the client bundle, so the literal value doesn't leak, BUT the import path can drag server-only code (and its other secrets) into client-bundle land.
3. **`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`** — accidentally prefixing the service-role key with `NEXT_PUBLIC_` exposes it to every page.

## Findings

### 1. Hardcoded JWT scan — CLEAN

```bash
grep -rnE 'eyJ[A-Za-z0-9_-]{30,}' src/
# → zero matches
```

No file under `src/` contains a literal JWT. Memory rule #54's showcase-page pattern (`/bounty`, `/benchmarks`, `/leaderboard` style server components) is **not** present in ToolRoute today.

### 2. `"use client"` file imports of server libs — CLEAN

10 client components found:

```
src/app/dashboard/billing/page.tsx
src/app/dashboard/keys/page.tsx
src/app/dashboard/layout.tsx
src/app/dashboard/page.tsx
src/app/dashboard/providers/page.tsx
src/app/dashboard/usage/page.tsx
src/app/login/page.tsx
src/app/playground/page.tsx
src/app/signup/page.tsx
src/app/tools/ToolsClient.tsx
```

None imports `@/lib/gateway` or `@/lib/supabase-server`. The two server libs that hold `supabaseAdmin()` factory + service-role key are reached only by API routes (`src/app/api/**`) and the auth callback (`src/app/auth/callback/route.ts`) — all server-only.

### 3. `NEXT_PUBLIC_*` misnaming — CLEAN

```bash
grep -rn "NEXT_PUBLIC_" src/lib/ src/app/ | grep -iE "service|admin|secret"
# → zero matches
```

No `NEXT_PUBLIC_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_ADMIN_KEY` / similar misnamed env var.

## Where service-role IS used (all server-only — verified)

| Path | Surface |
|------|---------|
| `src/lib/gateway.ts` | `supabaseAdmin()` factory + `getUserFromSession()` + Stripe helpers |
| `src/lib/supabase-server.ts` | `createClient` with service-role key |
| `src/app/api/admin/providers/route.ts` | Admin provider config |
| `src/app/api/admin/stats/route.ts` | Admin stats |
| `src/app/api/v1/billing/setup-payment/route.ts` | Stripe customer create |
| `src/app/api/v1/byok/route.ts` | BYOK key write |
| `src/app/api/v1/keys/route.ts` | API key CRUD |
| `src/app/api/v1/registry/{challenge,request,usage}/route.ts` | Tool registry RPCs |
| `src/app/api/v1/settings/route.ts` | User settings PATCH |
| `src/app/api/v1/signup/route.ts` | User signup |
| `src/app/api/v1/tools/route.ts` | Tool catalog admin |
| `src/app/api/v1/usage/route.ts` | Usage events read |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook handler |
| `src/app/auth/callback/route.ts` | Magic-link / OAuth callback |

All paths under `src/app/api/**` are Next.js Route Handlers (server-only by definition). `src/app/auth/callback/route.ts` is also a Route Handler. `src/lib/*-server.ts` and `src/lib/gateway.ts` are server libs only ever imported by Route Handlers.

## P3 follow-up — `import "server-only"` defensive marker

Both `src/lib/gateway.ts` and `src/lib/supabase-server.ts` should add `import "server-only"` as the first import:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
// ...
```

Effect: if any future PR introduces a `"use client"` component that imports these libs (directly or transitively), Next.js compile FAILS LOUDLY with `You're importing a component that imports server-only`. Without this marker, the Next.js compiler silently strips `process.env.SUPABASE_SERVICE_ROLE_KEY` to `undefined` in the client bundle — no key leak, but the supabaseAdmin client fails at runtime in the browser instead of erroring at build.

This is a 1-line + 1-package-install change. Out of scope for this audit because:
- `server-only` package is not currently a dep — adding it modifies `package.json` + lockfile, deserving its own PR.
- This audit is the "is there a live leak" question; the answer is no.

Tracked as Lane 4.26-followup. Recommended timeline: ship with the next dep-update PR.

## Drift prevention — vitest

`tests/unit/service-role-bundle-shape.test.ts` (Hard Rule #59) asserts:

1. **No hardcoded JWT** under `src/` — pattern `eyJ[A-Za-z0-9_-]{30,}\.` returns zero matches.
2. **No `"use client"` file imports server libs** — every file containing `"use client"` directive must NOT import `@/lib/gateway` or `@/lib/supabase-server` (direct or via relative paths).
3. **No `NEXT_PUBLIC_*` env var name contains forbidden tokens** — `service`, `admin`, `secret`, `private`, `service_role`.
4. **Service-role usage stays server-side** — every file that references `SUPABASE_SERVICE_ROLE_KEY` or `supabaseAdmin` lives under `src/app/api/`, `src/app/auth/`, or `src/lib/`.

Test fails master if anyone:
- Inlines a JWT into source.
- Adds `"use client"` to gateway.ts / supabase-server.ts (or imports them from a client component).
- Misnames a service-role env var with `NEXT_PUBLIC_*` prefix.
- Drops a service-role usage into `src/components/` or other client-bundle locations.

## Cross-applies to

Same 3-step grep + boundary check on every Justin product:

- **CallTwin** — magic-link signup + Vapi config server lib
- **DropClose** — admin Vapi/lead config
- **AffixedAI** — template+billing server lib
- **JarvisCRM** — auto-generated server libs (highest risk — generators frequently spread imports)
- **PureUSPeptide2** — checkout server lib + WooCommerce sync
- **PeptideAI** — inventory + edge-function-callable server lib

10-min audit per product:
```bash
grep -rnE 'eyJ[A-Za-z0-9_-]{30,}' src/
grep -l '"use client"' -r src/ | xargs grep -lE 'from\s+["@]/?lib/(gateway|supabase|server)'
grep -rn "NEXT_PUBLIC_" src/ | grep -iE "service|admin|secret|private"
```

Any non-empty output = stop, audit, fix.

## Conclusion

ToolRoute service-role surface is NOT exposed in the client bundle today. Drift test locks the property forever. `server-only` package install is recommended as a follow-up for compile-time defense-in-depth.
