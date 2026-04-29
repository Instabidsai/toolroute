// Lane 4.112 — drift-prevention test for two claim classes that lagged reality.
//
// Walks src/app/**/*.{tsx,md}, src/content/*.md, public/llms*.txt for:
//
//   (A) AES-256 encryption claims.
//       Until Codex ticket #52 (BYOK Vault encryption) ships, any "AES-256"
//       claim must be co-located with a roadmap qualifier ("Codex ticket #52",
//       "in active development", "on the security roadmap") within 200 chars.
//       Rationale: src/app/api/v1/byok/route.ts:31 currently writes plaintext
//       to user_provider_keys.api_key_encrypted (TODO: encrypt with KMS).
//       Lane 4.110 enumerated 12 drifted surfaces.
//
//   (B) Class-A adapter slug references in marketing prose.
//       Any reference to a BYOK_REQUIRED_SLUGS adapter (per
//       src/lib/byok-required-slugs.ts) outside a code-block, in marketing
//       prose, must be co-located with a "BYOK required" / "BYOK-required" /
//       "premium providers require BYOK" qualifier within 200 chars.
//       Rationale: Lane 4.100 (P0 ACTIVE LEAK), 4.102 (broken-by-design),
//       6.14 (final ToS) — these adapters cannot be served via master pool.
//       Lane 4.111 enumerated 3 drifted surfaces (homepage, positioning-v2,
//       pricing-page subset).
//
// Today this test FAILS — that's intentional. The failure list IS the
// canonical drift TODO list per Hard Rule #59. As Codex Lane 4.110-impl /
// Lane 4.111-impl land, the failure count shrinks. Hits 0 → CI guards forever.
//
// To temporarily silence in CI while sibling lanes ship:
//   CLASS_A_DRIFT_BASELINE=skip
//
// Cross-refs:
//   .agent/lane-4.110-aes256-deception-class-cross-page.md
//   .agent/lane-4.111-homepage-positioning-class-a-drift.md
//   src/lib/byok-required-slugs.ts (single source of truth for Class-A)
//   tests/unit/marketing-snippet-drift.test.ts (Lane 6.4.4 sibling pattern)

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BYOK_REQUIRED_SLUGS } from "../../src/lib/byok-required-slugs";

const root = process.cwd();
const appDir = resolve(root, "src/app");
const contentDir = resolve(root, "src/content");
const publicDir = resolve(root, "public");

const SHOULD_RUN = process.env.CLASS_A_DRIFT_BASELINE !== "skip";

const ENCRYPTION_QUALIFIERS = [
  "Codex ticket #52",
  "in active development",
  "on the security roadmap",
  "is planned",
  "currently stored with",
];

const CLASS_A_QUALIFIERS = [
  "BYOK required",
  "BYOK-required",
  "BYOK is required",
  "require BYOK",
  "requires BYOK",
  "premium providers",
  "Bring-Your-Own-Key",
  "Bring Your Own Key",
];

function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full, exts));
    } else if (s.isFile() && exts.some((ext) => name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  matchText: string;
  context: string;
}

function findClaimHits(
  files: string[],
  pattern: RegExp,
  contextWindow = 200,
): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(content)) !== null) {
      const idx = m.index;
      const start = Math.max(0, idx - contextWindow);
      const end = Math.min(content.length, idx + m[0].length + contextWindow);
      const context = content.slice(start, end);
      const line = content.slice(0, idx).split("\n").length;
      hits.push({
        file: relative(root, file).replace(/\\/g, "/"),
        line,
        matchText: m[0],
        context,
      });
    }
  }
  return hits;
}

function publicReadableFiles(): string[] {
  const files: string[] = [];
  files.push(...walk(appDir, [".tsx", ".md", ".mdx"]));
  files.push(...walk(contentDir, [".md", ".mdx"]));
  if (existsSync(publicDir)) {
    for (const name of readdirSync(publicDir)) {
      if (/^llms.*\.txt$/.test(name)) {
        files.push(join(publicDir, name));
      }
    }
    // OpenAPI spec is the canonical machine-readable API contract — agents
    // using OpenAPIToolkit / OpenAI tool-use generators / MCP-via-OpenAPI
    // bridges consume these files to discover what they can call. Class-A
    // BYOK disclosure must travel through the same surface.
    const openapi = join(publicDir, "openapi.json");
    if (existsSync(openapi)) files.push(openapi);
    const wellKnownOpenapi = join(publicDir, ".well-known", "openapi.json");
    if (existsSync(wellKnownOpenapi)) files.push(wellKnownOpenapi);
  }
  return files;
}

describe.skipIf(!SHOULD_RUN)("Class-A + encryption claim drift (Lane 4.112)", () => {
  it("AES-256 claims must be near a roadmap qualifier (Codex ticket #52)", () => {
    const files = publicReadableFiles();
    const hits = findClaimHits(files, /AES-?256/gi);

    const drifts = hits.filter(
      (h) => !ENCRYPTION_QUALIFIERS.some((q) => h.context.includes(q)),
    );

    const lines = drifts.map(
      (d) => `${d.file}:${d.line} — "${d.matchText}" without roadmap qualifier`,
    );

    expect(
      drifts,
      `\n${drifts.length} AES-256 drift(s) — each must say "Codex ticket #52" or "in active development" within 200 chars:\n${lines.join("\n")}\n\nUntil Lane 4.36-impl ships, the column user_provider_keys.api_key_encrypted is plaintext (src/app/api/v1/byok/route.ts:31).\n`,
    ).toEqual([]);
  });

  it("Class-A adapter slug refs must be near a BYOK-required qualifier", () => {
    const files = publicReadableFiles();
    const drifts: Hit[] = [];

    for (const slug of BYOK_REQUIRED_SLUGS) {
      // Match `<slug>/<op>` style references in code blocks/prose, e.g.
      // `claude/chat`, `stripe/charge`, `openai/embed`. Word-boundary on the
      // slug prevents matching inside other identifiers.
      const re = new RegExp(`\\b${slug}/[a-z][a-z0-9_-]*`, "g");
      const hits = findClaimHits(files, re);
      for (const h of hits) {
        // Skip references inside the adapter file itself (false positive in src/app/)
        if (h.file.includes("/lib/adapters/")) continue;
        // Skip references in audit memos (.agent/) — they describe the drift
        if (h.file.includes("/.agent/")) continue;
        // Skip Next.js metadata convention files — `image/png` etc. are MIME
        // types in opengraph-image.tsx / twitter-image.tsx / icon.tsx, not
        // Class-A slug refs. Same applies to any `<route>/contentType` line.
        const baseName = h.file.split("/").pop() ?? "";
        if (
          /^(opengraph|twitter|apple|icon|favicon)-?image\.(tsx|ts|jsx|js)$/.test(
            baseName,
          ) ||
          /^icon\.(tsx|ts|jsx|js)$/.test(baseName) ||
          /^apple-icon\.(tsx|ts|jsx|js)$/.test(baseName)
        ) {
          continue;
        }
        // Belt-and-suspenders: skip MIME-type matches across all files
        // (image/png, image/jpeg, image/svg+xml, image/webp, etc.).
        if (/^image\/(png|jpeg|jpg|gif|svg(\+xml)?|webp|avif|x-icon|bmp|tiff)$/.test(
          h.matchText,
        )) {
          continue;
        }

        const ok = CLASS_A_QUALIFIERS.some((q) => h.context.includes(q));
        if (!ok) drifts.push(h);
      }
    }

    const lines = drifts.map(
      (d) => `${d.file}:${d.line} — "${d.matchText}" without BYOK-required qualifier`,
    );

    expect(
      drifts,
      `\n${drifts.length} Class-A slug drift(s) — each must say "BYOK required" / "premium providers" / similar within 200 chars:\n${lines.join("\n")}\n\nClass-A providers cannot be served via master pool per ToS (Lane 4.100, 4.102, 6.14). See src/lib/byok-required-slugs.ts for the canonical list.\n`,
    ).toEqual([]);
  });
});
