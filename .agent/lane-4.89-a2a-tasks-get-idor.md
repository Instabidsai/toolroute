# Lane 4.89 — A2A `tasks/get` and `tasks/cancel` Are Unauthenticated IDORs

**Class**: IDOR + missing-auth on JSON-RPC method dispatcher
**Severity**: HIGH (any third party who guesses or learns a task_id can read another customer's tool-execution artifacts; can also cancel their tasks)
**Date**: 2026-04-28
**Sibling lanes**: 4.30 (IDOR audit on session-authed routes — missed API-key-authed A2A surface), 4.33 (route auth coverage drift guard — passed because `POST /api/a2a` exists; missed that JSON-RPC method-level dispatch has its own auth boundary), 4.43 (mcp-server error redaction — adjacent surface)

---

## Symptom

`src/app/api/a2a/route.ts` dispatches three JSON-RPC methods. Auth handling is **inconsistent**:

| Method | Auth check? | Owner stored? | Owner checked on read/cancel? |
|---|---|---|---|
| `tasks/send` | ✅ Yes (line 117: `Bearer tr_live_`) | ❌ No (task object has no `userId`) | n/a |
| `tasks/get`  | ❌ **None** | n/a | ❌ **None** |
| `tasks/cancel` | ❌ **None** | n/a | ❌ **None** |

```ts
case "tasks/get": {
  const params = body.params as { id?: string } | undefined;
  const taskId = params?.id;
  if (!taskId) {
    response.error = { code: -32602, message: "Missing task id" };
    break;
  }
  const task = taskStore.get(taskId);   // ← raw lookup, no owner check
  if (!task) {
    response.error = { code: -32602, message: `Task not found: ${taskId}` };
    break;
  }
  response.result = task;               // ← returns full artifacts
  break;
}

case "tasks/cancel": {
  const params = body.params as { id?: string } | undefined;
  const taskId = params?.id;
  if (!taskId) { ... }
  const task = taskStore.get(taskId);   // ← same: raw lookup
  if (!task) { ... }
  task.status = { state: "canceled" };  // ← anyone can cancel anyone's task
  task.updated_at = new Date().toISOString();
  response.result = task;
  break;
}
```

Stored task object (lines 197-207, 222-233) has **no `userId` / `owner` field** — even if we added auth-checks, there's no data to enforce ownership against.

---

## Attack scenarios

### 1. Predictable / customer-supplied task IDs (trivial)

`tasks/send` line 100: `const taskId = params?.id ?? \`task_${randomBytes(12).toString("hex")}\`;`

Customer A is allowed to **supply their own `id`** in the JSON-RPC params. If they pick a predictable value (e.g., `"task_1"`, `"my_query_42"`, or anything an MCP/A2A client SDK auto-generates as a sequential counter):

```jsonrpc
// Attacker — no API key needed:
POST /api/a2a
{ "jsonrpc": "2.0", "id": 1, "method": "tasks/get", "params": { "id": "task_1" } }

→ 200 OK, returns Customer A's full artifact (LLM output, tool result, scraped page, sent-email body, etc.)
```

### 2. Random 96-bit IDs (mostly safe, but leaks happen)

When customer doesn't supply an ID, ToolRoute generates `task_<24 hex chars>` = 96 bits. Brute-force is infeasible. But task IDs **leak through normal channels**:

- Customer's own application logs the task_id alongside a request_id
- Customer-side error reporting (Sentry, etc.) captures the task_id
- Backend logs on customer's infra ship task_id to a SIEM
- Task IDs end up in agent-system trace exports shared with vendors
- HTTP response bodies in browser DevTools / network captures
- A2A clients commonly stash task IDs in client-visible state for polling

Anyone who reads any of those logs can `tasks/get` the artifact.

### 3. `tasks/cancel` denial — same vector

Same vector as #1 / #2 lets an attacker cancel any in-flight task they can name. Cancellation only mutates `state: "canceled"` in-memory (doesn't actually stop a running upstream call), but it corrupts the task's reported state for the legitimate owner who's polling.

### 4. Cross-customer artifact disclosure on shared instances

Two customers' tasks both live in the same Vercel function-instance's `taskStore`. Customer B can iterate possible IDs (or grab them from any leaked source above) and read Customer A's artifacts directly.

---

## What artifacts actually leak

`tasks/send` calls `executeToolRequest(ctx, "auto/route", { task: textContent })` and stores the result. Artifacts contain `JSON.stringify(result.data ?? { error: result.error })`. Concrete content classes that have already been shipped to `taskStore` in production tests:

- LLM completions (GPT-4 / Claude responses — may include user-private prompts in the customer's `task` text echoed back)
- Web-search results (Tavily / search-adapter)
- Scraped page content
- Sent-email metadata + body (`/textbelt`, `/email`, `/resend` adapters)
- Sent-SMS metadata + body
- Generated image URLs (Replicate, image-gen)
- Code execution results
- Pretty much any tool output the auto-router selects

Plus the original message text in the `routing` artifact (line 155). Customer's prompt text leaks too.

---

## Why prior lanes missed this

**Lane 4.30** (IDOR audit) explicitly scoped to "session-authed mutation routes" — A2A's `/api/a2a` is API-key-authed (and only on the `tasks/send` sub-method, not the read/cancel sub-methods). Out of scope.

**Lane 4.33** (route auth coverage drift guard) treats each Next.js route file as one auth boundary. `/api/a2a/route.ts` exists, has an auth check inside, ✅ passes. Drift guard can't see that the auth check is gated to ONE of three JSON-RPC methods inside the same handler.

This is a **JSON-RPC-shaped auth gap that Next.js-route-shaped audits can't catch.** Same class lives in any RPC dispatcher (MCP route also dispatches multiple methods, see "Related" below).

---

## Severity rationale (HIGH, not CRITICAL)

- **+ severity**: Zero-auth required to read; full artifact disclosure; cross-customer leak; affects A2A — a paid premium feature where customer trust is the value prop.
- **− severity**: Random 96-bit auto-IDs are unguessable absent a leak; in-memory `taskStore` is process-local (only customers hitting same Vercel instance) and 1-hour-lived; A2A traffic volume in early production is presumably modest.

Net: HIGH. Still well below CRITICAL because successful exploitation needs either a customer-supplied predictable ID or a leaked random ID. Both are entirely realistic.

---

## Recommended fix — `[lane-4.89-impl]` Codex ticket

### Change 1 — store `userId` on the task

```ts
// In tasks/send success and failure paths:
const task = {
  id: taskId,
  userId: ctx.userId,                       // ← ADD
  status: { state: "completed" /* or "failed" */ },
  artifacts,
  created_at: now,
  updated_at: now,
};
```

Update the `taskStore` Map's value type to include `userId: string`.

### Change 2 — auth + ownership-check on `tasks/get`

```ts
case "tasks/get": {
  const params = body.params as { id?: string } | undefined;
  const taskId = params?.id;
  if (!taskId) {
    response.error = { code: -32602, message: "Missing task id" };
    break;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer tr_live_")) {
    response.error = {
      code: -32001,
      message: "API key required. Set Authorization: Bearer tr_live_xxx header.",
    };
    break;
  }

  const { validateRequest } = await import("@/lib/gateway");
  let ctx;
  try {
    ctx = await validateRequest(authHeader);
  } catch (err) {
    response.error = {
      code: -32001,
      message: err instanceof Error ? err.message : "Auth failed",
    };
    break;
  }

  const task = taskStore.get(taskId);
  if (!task || task.userId !== ctx.userId) {
    // SAME error for not-found and not-owned (no enumeration oracle)
    response.error = { code: -32602, message: `Task not found: ${taskId}` };
    break;
  }

  response.result = task;
  break;
}
```

Key detail: same error for "task doesn't exist" AND "task exists but owned by someone else" — otherwise the response timing/wording becomes an enumeration oracle.

### Change 3 — same for `tasks/cancel`

Mirror the auth + ownership check in `tasks/cancel`.

### Change 4 — reject customer-supplied task_id (harden against #1 attack)

Either:
- **Option A** (preferred): always auto-generate, ignore `params.id`. Simpler, eliminates predictable-ID attack class entirely.
- **Option B**: keep `params.id` but require it match `^task_[a-f0-9]{24}$` (server-format, 96 random bits). Customer must use a server-issued ID — but they could still collide their own existing IDs, so server should still randomize on collision.

Option A is the right call; A2A clients don't need control over task IDs.

### Change 5 — drift guard

`tests/unit/a2a-tasks-get-cancel-auth.test.ts` — parse `src/app/api/a2a/route.ts`, assert that **both** `case "tasks/get":` and `case "tasks/cancel":` blocks contain:
- `request.headers.get("authorization")` AND `Bearer tr_live_` substring (auth check)
- `task.userId !== ctx.userId` substring (ownership check)

Pattern: regex-extract each case body, `RegExp.exec` for the two markers, fail if either is missing. Sibling to drift-guards from Lanes 4.81 / 4.83 / 4.84 / 4.85 / 4.86 / 4.87 / 4.88.

### Architectural follow-up (out of scope for this ticket)

`taskStore` being in-memory + process-local also breaks the legit user flow on Vercel (customer's `tasks/get` poll hits a different instance than their `tasks/send` did → "task not found"). Should move to a Supabase table `a2a_tasks (id, user_id, status, artifacts, created_at, updated_at)` with TTL cleanup. Track as Lane 4.90 if Justin wants it; security fix above doesn't depend on the storage swap.

---

## Acceptance

- [ ] `tasks/get` requires `Authorization: Bearer tr_live_xxx`
- [ ] `tasks/get` returns "Task not found" for both genuinely-missing AND not-owned-by-this-user IDs (no enumeration oracle)
- [ ] `tasks/cancel` requires same auth + ownership check
- [ ] `tasks/send` ignores customer-supplied `params.id` and always auto-generates
- [ ] Stored task has `userId` field
- [ ] Drift-guard test fails if any of the three method-level checks is removed
- [ ] Smoke: Customer A `tasks/send` → notes returned `id` → Customer B (different `tr_live_` key) `tasks/get` with that id → "Task not found"
- [ ] Smoke: anonymous (no Authorization header) `tasks/get` → -32001 "API key required"

## Out of scope

- Migrating `taskStore` to Supabase (separate Lane 4.90)
- Sub-task / streaming progress (`tasks/sendSubscribe`) — A2A protocol method not yet implemented
- MCP route equivalent audit (see "Related")

## Related observations

- The MCP route (`src/app/mcp/route.ts`) dispatches `initialize`, `tools/list`, `tools/call`, `notifications/initialized`. Only `tools/call` checks auth. `tools/list` is intentionally public (catalog discovery). `initialize` and `notifications/initialized` are stateless metadata — no IDOR there. So MCP is fine. Confirmed by re-reading the file.
- The pattern is general: **JSON-RPC method-level auth needs per-method audit; route-level auth audits don't see inside the dispatch switch.** Worth a CLAUDE-rule entry once the pattern repeats once more.
- Lane 4.30's scope-note ("session-authed mutations") was correct given that lane's intent — this isn't a Lane 4.30 regression, it's a coverage gap that A2A's API-key surface fell into. Audit-coverage gaps from sibling-lane scope are a recurring class (rule #36 maturity-pass equivalent).
