# Lane 4.110 — `api_key_encrypted: api_key, // TODO: encrypt with KMS` is the smoking gun behind 12 false AES-256 marketing claims (HIGH / FTC §5)

**Owner:** Claude (auditor)
**Started:** 2026-04-29
**Severity:** HIGH (FTC §5 deception class + California §22576 / NY SHIELD Act / MA 201 CMR 17 — false security claim, not just drift)
**Action:** P0 pre-launch blocker. Two valid remediation paths, must take ONE before any go-live press:
1. Ship Codex ticket #52 (BYOK Vault encryption) FIRST, then verify claims become true
2. Strip / soften every "AES-256" claim across 12 surfaces NOW (interim correction); restore wording when ticket #52 ships

This is broader than Lane 4.109 (which was llms-full.txt-only). Same root cause class.

## TL;DR — the source-of-truth contradiction

`src/app/api/v1/byok/route.ts:31` writes plaintext to the DB:
```ts
.upsert({
  user_id: userId,
  tool_slug,
  api_key_encrypted: api_key,   // TODO: encrypt with KMS
  is_active: true,
  // ...
})
```

The column name `api_key_encrypted` is misleading; the **value written is the plaintext bearer of the user's third-party API key**. The author's own TODO comment is the proof.

Meanwhile, **12 public surfaces** assert keys are AES-256 encrypted:

## File:line evidence — every false claim

### Source code (the contradiction)
- `src/app/api/v1/byok/route.ts:31` — `api_key_encrypted: api_key, // TODO: encrypt with KMS` (THE TRUTH)

### Marketing claims contradicting the truth
1. `src/app/agents/page.tsx:70` — "keys are encrypted at rest with AES-256"
2. `src/app/agents/page.tsx:528` — "keys are encrypted at rest with AES-256"
3. `src/app/faq/page.tsx:96` — "keys are encrypted at rest with AES-256 (never stored in plaintext)"
4. `src/app/faq/page.tsx:102` — "All credentials are encrypted at rest with AES-256 and decrypted only at execution time"
5. `src/app/glossary/page.tsx:83` — "Keys are typically encrypted at rest (AES-256) and never stored in plaintext"
6. `src/app/docs/page.tsx:1510` — "Keys are encrypted at rest with AES-256"
7. `src/app/docs/page.tsx:2069` — "BYOK support for 34 providers with AES-256 encryption"
8. `src/app/blog/bring-your-own-key-mcp-byok/page.tsx:13` — "Keys encrypted at rest"
9. `src/app/blog/bring-your-own-key-mcp-byok/page.tsx:349-350` — "**Encrypted at rest.** Every BYOK key is encrypted using AES-256-GCM before it touches the database"
10. `src/app/blog/oauth-for-ai-agents-composio-vs-manual/page.tsx:230` — "(AES-256-GCM with a KMS-managed key), rotate the key annually"
11. `public/llms-full.txt:1093` — "Keys are encrypted at rest with AES-256" (already in Lane 4.109; this lane supersedes/expands)
12. `src/content/positioning-v2.md` — implicit claims via reposting marketing copy (verify on review)

The blog post (line 350) is **especially specific**: "AES-256-GCM with a KMS-managed key" — a level of detail that goes beyond aspirational copy. Discovery counsel will treat this as a deliberate, knowing misrepresentation.

## Why HIGH severity (not MEDIUM like Lane 4.109)

### FTC §5 — Deception
Test: would a reasonable consumer be misled by the claim and rely on it to their detriment? Yes — security-conscious customers select gateways based on encryption posture; "AES-256-GCM with KMS" is the load-bearing claim.

### California §22576 / Online Privacy Protection Act
Operators must comply with their posted privacy policies. If the policy says encrypted, the operator must encrypt. A policy violation here is a state-AG enforceable claim.

### NY SHIELD Act / MA 201 CMR 17
Both impose "reasonable security" with specific encryption obligations for resident data. A breach disclosure on a "we encrypted with AES-256" page that turns out to be plaintext is a regulator gift.

### Brand / acquirer DD risk
Any acquirer or insurance underwriter doing technical DD will read the page → grep the source → find the TODO. Deal valuation hit + insurance E&O denial.

### Lane 4.109 was MEDIUM because it was one file. This is HIGH because:
- 12 surfaces with consistent claim
- Source code TODO comment is *direct evidence the author knew*
- One blog claim is so specific (KMS, GCM mode, annual rotation) it cannot plausibly be aspirational

## Two-path remediation

### Path A — claim removal (FAST, safe, takes 30 min)
Replace every "AES-256 at rest" claim with something defensible TODAY:

> "BYOK keys are stored in Supabase with row-level access controls (only the owning user can read their own keys via RLS). Encryption at rest using KMS-managed AES-256-GCM is on the security roadmap (Codex ticket #52)."

This converts a false specific claim into a true general claim + roadmap pointer. Same pattern as the Resend "domain unverified" honest disclosure.

### Path B — ship Codex ticket #52 FIRST, then verify
Codex ticket #52 = `Lane 4.36-impl — Codex ticket: BYOK Vault encryption`. Ship pgsodium / Supabase Vault encryption on `user_provider_keys.api_key_encrypted`. Then:
1. Re-probe: read row via service-role; confirm value is ciphertext, not plaintext
2. Verify decryption path in `gateway.ts` works for execute-time
3. Migrate existing rows (key rotation event for any pre-encryption keys)
4. Only THEN can the AES-256 marketing claims be honest

Path B is the right end state. Path A is the right intermediate.

**Recommend: do BOTH.** Path A this week (interim correction); Path B in parallel (durable fix).

## Codex ticket (concrete) — paired with #52

```
Title: Lane 4.110 — interim correction: strip AES-256 claims until Codex ticket #52 ships

Files to change (12 surfaces):
- src/app/agents/page.tsx (lines 70, 528)
- src/app/faq/page.tsx (lines 96, 102)
- src/app/glossary/page.tsx (line 83)
- src/app/docs/page.tsx (lines 1510, 2069)
- src/app/blog/bring-your-own-key-mcp-byok/page.tsx (lines 13, 349-350)
- src/app/blog/oauth-for-ai-agents-composio-vs-manual/page.tsx (line 230 — this is about Composio, may need lighter-touch edit)
- public/llms-full.txt (line 1093 — already in Lane 4.109 ticket)
- src/content/positioning-v2.md (review)

Replacement text (template):
  "BYOK keys are stored in Supabase with row-level access controls (RLS limits reads
   to the owning user via service-role-gated RPC). Encryption at rest with AES-256-GCM
   under a KMS-managed key is in active development (Codex ticket #52); current keys
   will be migrated when the encryption layer ships."

Drift test (vitest):
- Walk all .tsx + .md + public/*.txt files
- grep for "AES-256" without "Codex ticket #52" or "in active development" within 200 chars
- Fail on any naked claim of encryption-at-rest until ticket #52 ships
- Once #52 ships and `user_provider_keys.api_key_encrypted` actually contains ciphertext,
  invert the test: require AES-256 claim to be present (provability assertion).

Acceptance:
- Live `/faq`, `/agents`, `/glossary`, `/docs`, both blog pages, llms-full.txt — no naked AES-256 claim
- Source-code grep `grep -rn "AES-256" src/ public/` returns either:
  (a) zero results, OR
  (b) only results adjacent to "Codex ticket #52" / "in active development"
```

## Sibling rules / lanes / hard rules

- **Lane 4.36** — original BYOK plaintext storage audit (where the TODO was first surfaced)
- **Codex ticket #52** — `Lane 4.36-impl` — the durable fix that hasn't shipped
- **Lane 4.106** — `tool_providers.auth_key_encrypted` plaintext (sibling — same misleading column-name pattern, master-pool side)
- **Lane 4.109** — llms-full.txt 3 drifts (this lane supersedes the encryption-claim portion; Class-A drifts in 4.109 are still independent)
- **Hard Rule #15** — security products cannot leak the finding class they charge to find. Variant: a tool-gateway cannot make false security claims about the keys it's the substrate for.
- **Hard Rule #57** — pre-launch copy audit before any tiered-access gate ships. This rule applies again at FOR ENCRYPTION CLAIMS specifically.
- **Hard Rule #59** — failing-snapshot test as drift TODO list. The vitest above is the canonical pattern.

## Acceptance for this audit memo

- [x] Read `src/app/api/v1/byok/route.ts:31` — confirmed `api_key_encrypted: api_key` plaintext write with author's TODO comment
- [x] Grep `src/` + `public/` for "encrypted at rest|AES-256|never stored in plaintext" — 12 surfaces enumerated with file:line
- [x] Cross-referenced Codex ticket #52 status — PENDING in `~/ToolRoute/.agent/codex-build-queue.md`
- [x] Confirmed Lane 4.36 was the original audit (the TODO has been there since at least Apr 27)
- [x] Severity bracketed against FTC §5 + California §22576 + NY SHIELD + MA 201 CMR 17
- [ ] **CODEX:** strip AES-256 claims (Path A) AND ship ticket #52 (Path B)
- [ ] **CLAUDE follow-up:** once Path A merges, write Lane 4.111 verifying every line struck; once Path B ships, write Lane 4.112 verifying ciphertext at rest

## Process-improvement note

Three audit lanes today (4.107, 4.108, 4.109) surfaced the **same pattern**: a stale claim or shipped-but-unverified work whose status drifted away from reality. This lane (4.110) is the worst case of that class. The shared remediation:

> **When an audit finds a "still PENDING" Codex ticket, the next step is NOT to write more depth audits — it's to grep every public-readable surface for claims that depend on that ticket having shipped.**

If we'd done that grep when Lane 4.36 wrote ticket #52 (~weeks ago), the 12 false claims would have been caught at the source. Add this to the audit pattern: **Pending ticket → search for premature claims that depend on it.**
