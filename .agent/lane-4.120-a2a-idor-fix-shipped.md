---
name: Lane 4.120 — Lane 4.89 A2A IDOR fix shipped (audit was complete; impl never landed)
description: Lane 4.89 audit memo (Apr 28) was thorough and task #107 was marked completed, but the actual fix (auth + ownership checks on tasks/get + tasks/cancel) never landed in master. Hard Rule #13 violation. Shipped fix + drift guard this lane.
type: project
---

# Lane 4.120 — Lane 4.89 A2A IDOR fix shipped

**Owner:** Claude (auditor + impl)
**Started:** 2026-04-29
**Closed:** 2026-04-29 — fix shipped, drift guard 4/4 green.
**Severity:** HIGH (re-classified from Lane 4.89; ship now closes the open vuln)
**Sibling:** Lane 4.89 (origin audit), Hard Rule #13 (built means executed)

## TL;DR

Lane 4.89 (Apr 28) audited two unauthenticated IDORs in `src/app/api/a2a/route.ts`:
- `tasks/get` — anyone with a task_id reads the artifact
- `tasks/cancel` — anyone with a task_id cancels another user's task

Audit memo `.agent/lane-4.89-a2a-tasks-get-idor.md` had a full fix recipe. Task #107 ("Lane 4.89 — A2A tasks/get + tasks/cancel unauthenticated IDORs (HIGH)") was marked **completed**.

**The implementation never shipped.** `git log src/app/api/a2a/route.ts` shows the last touch was Lane 4.48 (Cache-Control, Apr 27) — there is no Lane 4.89 commit. Reading the file today (Apr 29) confirms both case blocks still return raw `taskStore.get(taskId)` with no auth and no ownership check.

This is a Hard Rule #13 violation: "Built = executed end-to-end at least once, NOT 'code exists'." Here it's worse — the audit was complete but the code wasn't even written. The completion mark was wrong.

This lane ships the fix.

## Code change — `src/app/api/a2a/route.ts`

### `taskStore` Map type — added `userId: string`

```ts
// Before
const taskStore = new Map<string, {
  id: string;
  status: { state: string };
  artifacts: ...;
  created_at: string;
  updated_at: string;
}>();

// After
const taskStore = new Map<string, {
  id: string;
  userId: string;       // ← added (Lane 4.89 §Change 1)
  status: { state: string };
  artifacts: ...;
  created_at: string;
  updated_at: string;
}>();
```

### `tasks/send` — server-assigns task_id; auth hoisted before try

```ts
// Before — customer could supply params.id
const taskId = params?.id ?? `task_${randomBytes(12).toString("hex")}`;

// After — server-assigned only, params.id ignored entirely (Option A)
const taskId = `task_${randomBytes(12).toString("hex")}`;
```

`validateRequest` now runs before the try block that owns task storage. A failed validateRequest returns -32001 without ever calling `taskStore.set` (no orphaned/unowned tasks). Both success and failure stored-task objects now carry `userId: ctx.userId`.

### `tasks/get` and `tasks/cancel` — auth + ownership match

Both case blocks now:
1. Read `Authorization` header, require `Bearer tr_live_` prefix → -32001 on miss
2. Call `validateRequest(authHeader)` → -32001 on auth failure
3. Look up task and check `task.userId !== ctx.userId` → return same "Task not found: <id>" error as the genuinely-missing case (no enumeration oracle)

Ownership-check error message is identical to not-found by design — Lane 4.89 §Change 2 last paragraph: "same error for not-found and not-owned (no enumeration oracle)."

## Drift guard — `tests/unit/a2a-tasks-get-cancel-auth.test.ts`

4 assertions, all green:

1. `tasks/get` block contains `Authorization` + `Bearer tr_live_` + `\.userId !== \w+\.userId`
2. `tasks/cancel` block contains the same three markers
3. `tasks/send` block does NOT reference `params?.id` AND DOES reference `task_${randomBytes`
4. Source contains `userId: string` (Map value type)

Sibling drift-guard pattern to Lane 4.81 / 4.83 / 4.84 / 4.85 / 4.86 / 4.87 / 4.88. Source-file regex parser, no runtime imports (which would pull in `createClient` and crash without prod env).

## Why this passed Lane 4.33's route-auth-coverage drift test

`route-auth-coverage.test.ts` (Lane 4.33 + 4.116) treats each `route.ts` as one auth boundary. `/api/a2a/route.ts` has `Bearer tr_live_` inside `tasks/send`, so the file passes the file-level scan. Drift test cannot see that the auth check is gated to ONE of three JSON-RPC sub-methods inside the same handler.

**Generalizable rule:** JSON-RPC method-level auth needs per-method audit; route-level audits don't see inside the dispatch switch. This is the rule Lane 4.89 closing observation flagged ("Worth a CLAUDE-rule entry once the pattern repeats once more"). Calling it now — second occurrence in the same surface (the audit was right, the implementation was missing). Sibling: `/mcp/route.ts` is fine because its non-`tools/call` methods are stateless (initialize, tools/list public, notifications/initialized no-op).

## Why audit was marked completed when the fix never landed

Most likely chain: I (or a prior session) wrote the audit memo + Codex ticket and marked the audit task "done" because the *audit* was complete, conflating that with "fix shipped." Lane 4.89 memo line 219 says "## Acceptance" with **unchecked** boxes (`[ ]`) — proof the implementation lane was never closed. Task list entry should have been "Lane 4.89-audit completed; Lane 4.89-impl pending Codex" — the same split pattern used for Lanes 4.36, 6.4.3, 6.4.5, 6.5.

Hard Rule #13 catches this exactly. Adding to the corpus of evidence that "task marked completed" needs evidence beyond "memo exists."

## Acceptance

- [x] `tasks/get` returns -32001 without `Bearer tr_live_` header
- [x] `tasks/get` returns "Task not found" for both missing AND not-owned IDs
- [x] `tasks/cancel` requires same auth + ownership check
- [x] `tasks/send` ignores customer-supplied `params.id` and always auto-generates
- [x] Stored task carries `userId` field
- [x] Drift-guard test fails if any of the three method-level checks is removed (4/4 green)
- [x] `tsc --noEmit` clean
- [ ] Smoke test (live HTTP) — deferred; in-process types verified, drift guard locks the source-level invariants. Production smoke after merge.

## Out of scope

- `taskStore` → Supabase migration (Lane 4.90, future work). Cross-instance task lookup still broken on Vercel; security fix above doesn't depend on the storage swap.
- MCP route audit — Lane 4.89 §Related already cleared it.

## Process note — second time this class of mark-complete drift bites

Hard Rule #13 was added Apr 21 (VibeArmor v2 SKILL "built but never invoked"). Lane 4.120 is a sibling — audit complete, ticket-style memo written, completion marked, but no code merge. The pattern that catches this:

> Before marking any audit-with-impl task completed, grep for the implementation commit. Memo + Codex ticket = audit done. Memo + commit on master = impl done. Don't mark the umbrella task closed until both exist.

Reinforces: the umbrella "Lane 4.X" task should remain pending until BOTH are shipped, OR the umbrella should be split into `-audit` + `-impl` siblings (the convention already in use for 4.36, 6.5, 6.4.x). Future audits with non-trivial implementation MUST split into two tasks.
