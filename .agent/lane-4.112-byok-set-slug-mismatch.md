# Lane 4.112 — BYOK_REQUIRED_SLUGS uses provider names; adapters export operation slugs (runtime-gate gap)

**Owner:** Claude (auditor)
**Started:** 2026-04-29
**Severity:** HIGH-LATENT (becomes HIGH the day Codex ticket #23 ships)
**Action:** Codex ticket — reconcile slug naming OR add provider→adapter alias map. Surfaced *before* the runtime gate lands so the fix can be merged with #23.

## TL;DR

Two adapters in `src/lib/adapters/` export `slug: <operation_name>` while `BYOK_REQUIRED_SLUGS` in `src/lib/byok-required-slugs.ts` registers the *provider name*. When Codex #23 wires the runtime gate via `BYOK_REQUIRED_SLUGS.has(slug)`, both adapters will silently bypass the BYOK requirement and master-pool route in violation of provider ToS:

| Adapter file | Exports `slug` | BYOK_REQUIRED_SLUGS entry | Runtime match? |
|--------------|----------------|---------------------------|----------------|
| `image-gen-adapter.ts` | `"image"` | `"image-gen"` | ❌ MISS |
| `deepl-adapter.ts` | `"translate"` | `"deepl"` | ❌ MISS |

Same class: provider != operation. The Set was authored from Lane 6.7's BYOK ToS audit (which named providers); the adapters were authored from a UX angle (which named operations).

## File:line evidence

`src/lib/byok-required-slugs.ts:67-68`:
```ts
"image-gen",    // Fal.ai — "timesharing, service bureau" + API-exposure ban
"search",       // Brave Search API — Tier 2+3 stack (slug misleads)
```

`src/lib/byok-required-slugs.ts:56`:
```ts
"deepl",        // DeepL §8.1.4 + §5.2 explicit anti-aggregator policy
```

`src/lib/adapters/image-gen-adapter.ts:9-10`:
```ts
export const imageGenAdapter: ToolAdapter = {
  slug: "image",
```

`src/lib/adapters/deepl-adapter.ts` (slug):
```ts
slug: "translate",
```

(`search` is correct — `brave-search-adapter.ts` exports `slug: "search"`. Only `image-gen` + `deepl` are mismatched.)

## Why severity is HIGH-LATENT (not HIGH today)

The runtime gate (Codex ticket #23) hasn't shipped yet. Today, no BYOK enforcement runs in `gateway.ts`. The mismatch is dormant. The day #23 lands and merges code like:

```ts
if (BYOK_REQUIRED_SLUGS.has(toolSlug) && !byokKey) {
  throw new GatewayError("byok_required", 402, ...);
}
```

…calls to `image/generate` and `translate/text` will bypass the gate even when the master-pool key is set, generating ToS-violating revenue against Fal.ai and DeepL.

## Why it's worth surfacing now (not after #23 ships)

1. **#23 prep work is the right merge window.** If the gate lands as designed against the current Set, the gap ships with it. Fixing post-merge means a follow-up PR + a window where prod is broken-by-design.
2. **Two failure modes possible**:
   - (a) Rename Set entries to match adapter slugs (`image-gen` → `image`, `deepl` → `translate`). Cheapest. But Lane 6.7 source-of-truth markdown also uses `image-gen`/`deepl`, so the parity test (`tests/unit/byok-slug-list-parity.test.ts:53`) breaks unless the markdown is updated in lockstep.
   - (b) Add an alias map: `BYOK_PROVIDER_TO_ADAPTER_SLUG = { "image-gen": "image", "deepl": "translate" }` and change the runtime check to look up via the map. More flexible (handles future provider/operation drift) but adds indirection.
3. **Lane 4.109 doc-drift compounded.** `public/llms-full.txt:473,651` already mislabel these adapters as "BYOK: Yes" (optional). Fixing the docs to say "BYOK required (Class-A)" creates a worse inconsistency if the runtime gate misses them.

## Recommendation

**Option A** (cheapest): rename Set entries to match adapter slugs.
1. `src/lib/byok-required-slugs.ts:56` — `"deepl"` → `"translate"`
2. `src/lib/byok-required-slugs.ts:68` — `"image-gen"` → `"image"`
3. `.agent/lane-6.7-verified-byok-slug-list.md` — same two renames in the embedded code block (parity test reads from this file)
4. Add a comment retaining the provider name as inline doc: `"translate", // DeepL §8.1.4 (slug "translate" — adapter is deepl-adapter.ts)`

**Option B**: ship as part of the Codex #23 PR. Lower priority; just needs to be in the PR description.

## Sibling lanes

- **Lane 4.109** — llms-full.txt doc drift on these same two adapters
- **Lane 4.103** — catalog-listing has no Class-A awareness (sibling: catalog uses adapter slugs)
- **Codex ticket #23** — BYOK runtime gate (where this gap activates)
- **Lane 6.7** — markdown source-of-truth that also needs the rename

## Acceptance for this audit memo

- [x] Confirmed `imageGenAdapter.slug === "image"` ≠ `BYOK_REQUIRED_SLUGS` entry `"image-gen"`
- [x] Confirmed `deeplAdapter.slug === "translate"` ≠ `BYOK_REQUIRED_SLUGS` entry `"deepl"`
- [x] Spot-checked `search` (matches), `claude`/`stripe`/`supabase` (match) — only 2 mismatched today
- [ ] **CODEX:** Option A renames + Lane 6.7 markdown sync, OR alias-map approach in #23 PR
- [ ] Verify `byok-slug-list-parity.test.ts` passes after rename + markdown sync

## Process-improvement note

The parity test (`byok-slug-list-parity.test.ts`) guards Set ↔ markdown drift but does NOT guard Set ↔ adapter-export-slug drift. A small additional test asserting `BYOK_REQUIRED_SLUGS ⊆ {adapter.slug for every adapter in src/lib/adapters/}` would have caught this at PR time. Consider adding alongside the Option A fix.
