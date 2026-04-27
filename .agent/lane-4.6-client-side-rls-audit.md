# Lane 4.6 — Client-side RLS audit

**Purpose:** Enumerate every "use client" component that reads sensitive Supabase tables directly via the anon client + user JWT, so the Lane 0.1 lockdown (v1 + v2 SQLs) doesn't silently empty any dashboard surface.

**Pattern (Hard Rule #54):** When a client component does `supabase.from("X").select(...).eq("user_id", session.user.id)`, the client uses the public anon key with the user's JWT. PostgREST routes this as the `authenticated` role. If we blanket-REVOKE SELECT, the dashboard returns `[]` with `error: null` — silent failure. Fix is owner-scoped RLS: enable RLS, GRANT SELECT to authenticated, USING (user_id = auth.uid()).

## Audit method

```bash
# All client components:
grep -rln "^\"use client\"" src/app --include="*.tsx"

# Direct table reads inside each:
grep -nE "\.from\s*\(\s*['\"][a-z_]+['\"]\s*\)" "$file"
```

## Findings (2026-04-27)

| Client component | Line | Table | Filter | Lockdown approach |
|---|---|---|---|---|
| `src/app/dashboard/page.tsx` | 173 | `gateway_users` | `id = session.user.id` | Owner-scoped RLS |
| `src/app/dashboard/page.tsx` | 184, 190 | `gateway_usage_log` | `user_id = session.user.id` | Owner-scoped RLS |
| `src/app/dashboard/billing/page.tsx` | 258 | `credit_transactions` | `user_id = session.user.id` | Owner-scoped RLS |

**Other client components scanned with no direct sensitive-table reads:**

- `src/app/dashboard/keys/page.tsx` — uses `/api/v1/keys` REST route only
- `src/app/dashboard/layout.tsx` — auth check via `supabase.auth.getSession()` only
- `src/app/dashboard/providers/page.tsx` — uses `/api/v1/byok` REST route only
- `src/app/dashboard/usage/page.tsx` — proxies through `/api/v1/usage`
- `src/app/login/page.tsx` — auth only
- `src/app/playground/page.tsx` — calls `/api/v1/execute` with API key
- `src/app/signup/page.tsx` — calls `/api/v1/signup` REST route
- `src/app/tools/ToolsClient.tsx` — public catalog (`tools` table, intentionally anon-readable)

## What this means for the lockdown SQL

`scripts/lockdown-anon-read-leaks-v2.sql` was updated to:

1. **Blanket REVOKE** for server-only tables: `api_keys`, `user_provider_keys`, `tool_requests`.
2. **Owner-scoped RLS** for the three client-readable tables identified above: `gateway_users`, `gateway_usage_log`, `credit_transactions`.

If a future PR adds a new "use client" component reading a sensitive table, run this audit again before merging. The pattern is failure-mode-by-default: blanket REVOKE looks like it works (no compile error, no test failure) but produces empty arrays in production for legitimate users.

## Adjacent risk: server-routes-as-anon

This audit only covers `"use client"` components. A separate risk class is server routes that *should* use service role but accidentally use anon — same silent failure mode. Spot-checked all server routes touching the 8 sensitive tables (Lane 4.4 list), and every one uses `supabaseAdmin()` (service role bypasses RLS). No issues found.

## Cross-reference

- Sibling rule: MEMORY rule #54 (service_role-only RLS silently empties admin dashboards) — same root cause from the opposite direction (server reads as anon).
- New rule: MEMORY rule #56 (anon-read RLS audit: 200+[] is AMBIGUOUS, not LOCKED) — Lane 4.4 finding that drove this audit.
- Source-of-truth probe script: `scripts/verify-rls-lockdown.mjs`.
- The Lane 4.5 SQL (this audit's output) lives at `scripts/lockdown-anon-read-leaks-v2.sql`.
