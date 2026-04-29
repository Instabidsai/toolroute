# Lane 6.8.1 — BYOK slug data module (extract Lane 6.7 Sets to TS)

**Status:** SHIPPED
**Owner:** Claude (Lane 6)
**Hard Rule cross-refs:** #59 (failing-snapshot test as drift TODO list), #60 (provider-ToS resale grep checklist)
**Depends on:** Lane 6.7 (`.agent/lane-6.7-verified-byok-slug-list.md`)
**Unblocks:** Codex Lane 6.5-impl ticket #23

## Why this exists

Lane 6.7 produced a code-ready 49-slug Set in markdown. Codex's open ticket
(Lane 6.5-impl, queue #23) was waiting to wire those Sets into `gateway.ts`.
Without a TS module, that wiring would mean re-typing 49 slugs by hand and
re-doing per-slug ToS audit comments — a high-error, high-context-cost path.

This lane extracts the Sets to a single importable TS module so the Codex
runtime patch becomes a 5-LOC import + tier-switch, not a 130-LOC re-type.

## What shipped

| File | Purpose |
|------|---------|
| `src/lib/byok-required-slugs.ts` | Four exported `ReadonlySet<string>` constants + `classifyByokTier()` helper |
| `tests/unit/byok-slug-list-parity.test.ts` | Vitest source-walks Lane 6.7 markdown, asserts code matches |
| `.agent/lane-6.8.1-byok-slug-data-module.md` | This doc |

### Sets exported

| Constant | Size | Tier behavior |
|----------|------|---------------|
| `BYOK_REQUIRED_SLUGS` | 30 | 402 `byok_required` if no BYOK key |
| `BYOK_INSUFFICIENT_SLUGS` | 1 | 403 `forbidden_resale` always (apollo) |
| `AMBIGUOUS_DEFAULT_BYOK_SLUGS` | 18 | 402 `byok_required` (default conservative) |
| `TOOLROUTE_INTERNAL_SLUGS` | 2 | passthrough (auto, toolroute) |

Total gated: 49 of 51 catalog adapters (96%).

## Drift guard (Hard Rule #59)

`tests/unit/byok-slug-list-parity.test.ts` parses `.agent/lane-6.7-verified-byok-slug-list.md`
with regex extraction of each `new Set([...])` block, then asserts identity
with the imported TS constant. If Lane 6.6 v3 audit moves `apollo` from
`BYOK_INSUFFICIENT_SLUGS` to `BYOK_REQUIRED_SLUGS`, the test fails until the
TS module is updated to match.

The test does NOT import runtime gateway code (per the same global rule that
governs `tests/unit/marketing-snippet-drift.test.ts` and
`tests/unit/cogs-leak-audit.test.ts`) — registry imports often pull
`createClient` and crash without prod env. Source-walks only.

## Codex Lane 6.5-impl ticket #23 — what changes

Before (Lane 6.5 placeholder):
```ts
const BYOK_REQUIRED_SLUGS = new Set(["claude", "replicate", "elevenlabs", "resend"]);
```

After (Lane 6.8.1):
```ts
import {
  BYOK_REQUIRED_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
  AMBIGUOUS_DEFAULT_BYOK_SLUGS,
  classifyByokTier,
} from "@/lib/byok-required-slugs";
```

Plus the tier-aware gate body from Lane 6.7 lines 142-179.

## Follow-ups

- **6.8.2** (queued) — quarterly ToS recheck job for the 49 audited providers.
- **6.8.3** (queued) — Deepgram manual ToS audit (URL was unfetchable in 6.6).
- **6.8.4** (queued) — alternate-provider audit if Justin picks Strategy C.

## Justin decisions (still open from Lane 6.7)

- D9-D12: BYOK gate behavior (default 402, grace period, env var rotation).
- D4: apollo adapter — remove, waiver, or legal opinion.
- These are independent of 6.8.1 — the data module ships either way; the
  gate code that consumes it changes shape per Justin's call.
