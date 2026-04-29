# Lane 6.10 — `/dashboard/providers` tier-copy vs Lane 6.7 BYOK verdict

**Status:** AUDIT COMPLETE — drift guard shipped; UI fix tracked as TODO list inside the failing test.
**Owner:** Claude (Lane 6)
**Hard Rule cross-refs:** #57 (pre-launch copy audit), #59 (failing-snapshot test as drift TODO list)
**Depends on:** Lane 6.7 (`.agent/lane-6.7-verified-byok-slug-list.md`)
**Blocks:** Codex Lane 6.5-impl ticket #23 should NOT ship until either dashboard fix lands or copy is opted-out behind a feature flag.

## Why this exists

Lane 6.5-impl will ship a runtime BYOK gate that 402s for 30 BYOK_REQUIRED slugs and 403s for 1 BYOK_INSUFFICIENT slug. Two customer-facing artifacts will drift out of sync the moment that gate flips on:

1. **`/dashboard/providers` tier badges** — show 8 of those 31 slugs as `type: "pool"` (i.e. ToolRoute covers it). Customer reads "Pool" → calls `claude/messages` → gateway 402s. Promise vs reality mismatch is exactly the Hard Rule #57 failure class.

2. **Gate error message URL** — Lane 6.7 patch text said *"Register a key at `/dashboard/byok`"*. The route doesn't exist. Customer hits the link and gets a 404. **Fixed in this PR** — Lane 6.7 markdown now says `/dashboard/providers`.

## Drift findings (8 customer-facing claims that contradict Lane 6.7)

Source-of-truth: `.agent/lane-6.7-verified-byok-slug-list.md` lines 41-101.

### BYOK_REQUIRED but shown as `type: "pool"` (7)

| Slug | Currently | Lane 6.7 verdict |
|------|-----------|------------------|
| `claude` | `pool` | BYOK_REQUIRED — Anthropic Usage Policy §3 no resale |
| `replicate` | `pool` | BYOK_REQUIRED — Replicate AUP §2.7(c)(iii) "service bureau" |
| `elevenlabs` | `pool` | BYOK_REQUIRED — OEM Terms required for resale |
| `resend` | `pool` | BYOK_REQUIRED — §6 sender-domain mechanic forbids pooling |
| `sendgrid` | `pool` | BYOK_REQUIRED — Twilio MSA "transfer, resell, lease, license" |
| `search` | `pool` | BYOK_REQUIRED — Brave Search API Tier 2+3 stack |
| `heygen` | `pool` | BYOK_REQUIRED — HeyGen §2 anti-API-interface |

### BYOK_INSUFFICIENT but shown as `type: "pool"` (1)

| Slug | Currently | Lane 6.7 verdict |
|------|-----------|------------------|
| `apollo` | `pool` | BYOK_INSUFFICIENT — Apollo §3(g)(1) bans even BYOK passthrough. Adapter should not be a customer-facing offering. |

### Slug-name mismatch findings (informational, not blockers)

The dashboard PROVIDERS array uses slugs that don't exactly match the adapter slug used by the gateway. Lane 6.7 lists `image-gen` (Fal.ai) and `deepl`; the dashboard says `image` and `translate`. These are display-name aliases — the gateway routes `image-gen` and `deepl` regardless. But customers searching the BYOK page for "deepl" will not find it.

## Fix path — three options

### Option A — flip 8 dashboard tiers to `byok` (1-line edit each)

Cleanest. Drift test goes green. Customers see the BYOK tier on those providers from the moment they see the page, before any gate ships.

### Option B — remove apollo entirely + flip the other 7 to `byok`

Better aligns with Lane 6.7 D4 (apollo can't be offered at all under current ToS).

### Option C — gate behind feature flag

Keep dashboard as-is until Justin picks Strategy A/B/C from Lane 6.8 (master-pool architecture decision). Then dashboard reflects the chosen strategy in one PR.

**Recommendation: Option B** — reduces customer surprise the most, no waiting on Lane 6.8 strategy decision. Apollo removal is a separate Justin call.

## What this PR ships

| File | Purpose |
|------|---------|
| `tests/unit/dashboard-providers-tier-parity.test.ts` | Drift guard; fails with the 8-slug list above (Hard Rule #59) |
| `.agent/lane-6.7-verified-byok-slug-list.md` (1-line edit) | Fixes `/dashboard/byok` → `/dashboard/providers` URL drift in gate error message |
| `.agent/lane-6.10-dashboard-providers-tier-drift-audit.md` | This doc |

The dashboard UI fix is **NOT** in this PR — it's tracked by the failing test. Each future PR that flips one tier reduces the failure count. Test goes green when offender list is empty. Sibling pattern to `tests/unit/marketing-snippet-drift.test.ts`.

## Gate

Skipped via `DASHBOARD_TIER_DRIFT_BASELINE=skip` env var so CI stays green while
sibling lanes ship. Pattern matches `MARKETING_DRIFT_BASELINE` from Lane 6.4.4.

## Justin decisions

- **D13:** Apollo adapter — ship Option B (remove from dashboard) or wait for Lane 6.7 D4?
- **D14:** Dashboard tier flip — bundle into Codex Lane 6.5-impl PR, or separate Lane 6.10-impl PR?
