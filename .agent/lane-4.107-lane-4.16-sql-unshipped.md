# Lane 4.107 — Lane 4.16's SELECT-revoke SQL was never executed against prod (Justin-actionable)

**Owner:** Claude (auditor)
**Started:** 2026-04-28
**Severity:** HIGH-LATENT (same severity class as Lane 4.106, with a known fix that just needs to run)
**Action:** Justin to run `scripts/lockdown-anon-writes-and-admin-tables.sql` (Section 1) against prod. ~30 seconds in Supabase SQL editor.

## TL;DR

Lane 4.16 (committed earlier today, `.agent/lane-4.16-anon-write-grants-audit.md`) identified two AMBIGUOUS-state tables (`tool_providers`, `rate_limit_windows`) that needed anon SELECT REVOKE. It shipped the fix SQL at `scripts/lockdown-anon-writes-and-admin-tables.sql:39-61`. **That SQL was never executed against prod.**

Evidence:
- Live anon probe (2026-04-28, this tick) on both tables returns HTTP 200 + `[]` — same state Lane 4.16 documented as "not yet fixed".
- Lane 4.96's SQL header (line 23) **claims** "Lane 4.16 REVOKE'd anon SELECT on these tables" — that claim is false; only the write-revoke half of Lane 4.16's plan made it.
- Lane 4.106 (this morning) probed `tool_providers` and called it a new finding, then probed `user_provider_keys` (LOCKED) as the sister contrast — but the actual story is that `tool_providers` was **already** flagged in Lane 4.16 with the fix written; nobody ran the SQL.

## File:line evidence

### `scripts/lockdown-anon-writes-and-admin-tables.sql:31-61` — the unshipped SELECT-revoke
```sql
-- Section 1: REVOKE anon SELECT on admin-only tables (gap from Lane 4.5 v2)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tool_providers', 'rate_limit_windows']
  LOOP
    ...
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', tbl);
  END LOOP;
END $$;
```

### `scripts/lane-4.96-anon-write-grants-revoke.sql:23` — the false claim
```sql
-- Lane 4.16 REVOKE'd anon SELECT on these tables but did NOT revoke the
-- write grants. This lane closes that defense-in-depth gap.
```
Wrong. Lane 4.16 *proposed* the SELECT-revoke; the SQL was never executed. Lane 4.96 then ran on top of an assumption that wasn't verified.

### Live probes (this tick, 2026-04-28)
```
GET /rest/v1/tool_providers?select=*       → HTTP 200 []
GET /rest/v1/rate_limit_windows?select=*   → HTTP 200 []
POST /rest/v1/tool_providers     → HTTP 401 (write-revoke shipped via Lane 4.96)
POST /rest/v1/rate_limit_windows → HTTP 401 (write-revoke shipped via Lane 4.98)
```

So writes are properly revoked (Lane 4.96 + Lane 4.98 ran). SELECT-revoke (Lane 4.16) didn't.

## Why this is the right framing

Lane 4.106 (committed earlier today) was correct on its merits — the column is plaintext, the table is anon-readable, the leak class is real. But it framed the finding as **new**, missing that Lane 4.16's audit had already documented it AND written the fix. The actual story is:

1. **The SQL fix exists** (`lockdown-anon-writes-and-admin-tables.sql` Section 1).
2. **The SQL was never run**.
3. **Lane 4.96 was authored on the unverified assumption it had run**.

This is a *process-drift* finding more than a *new-vulnerability* finding. The vulnerability is identical to Lane 4.16; what's new is the discovery that the proposed fix never shipped.

## Justin's action (concrete, ~30s)

1. Open Supabase SQL editor for project `isbratmfnnzipzyoefbo`.
2. Paste contents of `scripts/lockdown-anon-writes-and-admin-tables.sql` (the whole file is idempotent — Section 1 alone would suffice but the full file is safe to re-run; Section 2 is no-op since Lane 4.96 already covered writes).
3. Verify with:
   ```
   curl ".../rest/v1/tool_providers?select=*&limit=1"      # MUST 401
   curl ".../rest/v1/rate_limit_windows?select=*&limit=1"  # MUST 401
   ```

## Why this matters for /loop directive

The /loop goal is "production-ready financial gateway." A pre-launch checklist that says "Lane 4.16 SELECT-revoke shipped" when in fact only the write-revoke half shipped is the kind of self-deception that makes launch-readiness reviews lie. This memo:

1. **Surfaces the unshipped SQL** so Justin can run it.
2. **Corrects Lane 4.96's claim** (line 23) so future audit memos don't compound the false assumption.
3. **Demonstrates the audit pattern**: when a memo's "applied" state is asserted from a sibling memo's header rather than a live probe, verify with a live probe before acting on it.

## Sibling rules / lanes

- Hard Rule #56 — anon-read 200+[] AMBIGUOUS, not LOCKED (the misread that Lane 4.96 made)
- Hard Rule #61 — Codex audit: table row counts beat artifact existence as execution proof (analog: applied-SQL claims need live-probe proof, not commit-message assertions)
- Lane 4.16 — original audit + proposed migration (today)
- Lane 4.96 — write-revoke that ran (today); header claim re Lane 4.16 SELECT-revoke is incorrect
- Lane 4.106 — today's re-discovery of `tool_providers` AMBIGUOUS state without spotting Lane 4.16's pre-existing fix proposal

## Acceptance for this audit memo

- [x] Lane 4.16 audit memo cross-referenced — confirmed proposed SELECT-revoke on tool_providers + rate_limit_windows
- [x] `scripts/lockdown-anon-writes-and-admin-tables.sql` Section 1 read — confirmed it contains the fix SQL
- [x] Live anon probes on both tables — HTTP 200 + `[]` (still AMBIGUOUS, fix unshipped)
- [x] Live anon write probe — HTTP 401 (Lane 4.96/4.98 write-revokes did ship)
- [x] Lane 4.96 SQL header line 23 cross-referenced — false claim identified
- [ ] **JUSTIN BLOCKER:** run `scripts/lockdown-anon-writes-and-admin-tables.sql` (Section 1) in Supabase SQL editor; verify with the two `curl` commands above
- [ ] Codex follow-up: amend Lane 4.96 SQL header line 23 in a future PR to clarify that Lane 4.16's SELECT-revoke SQL was unshipped at the time Lane 4.96 was authored

## Process-improvement note

This is the second time this loop has produced an audit memo whose finding turned out to be already-documented in a sibling lane (Lane 4.106 morning vs. Lane 4.16 morning). Both ran today, both probed `tool_providers` independently, both found AMBIGUOUS. Inserting a 30-second `grep -l "tool_providers" .agent/*.md` step before opening any new audit memo would have caught it.

Cheaper alternative: the audit-pattern checklist for new RLS-class memos should include "have I read the existing Lane 4.x memos that touch this same table?" before drafting.
