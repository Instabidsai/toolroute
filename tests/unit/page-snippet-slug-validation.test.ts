/**
 * Lane 6.4.1 — page-snippet slug validation
 *
 * Walks every src/app/**\/page.tsx, extracts every `tool: "X/Y"` pattern
 * from inline code snippets / curl examples, and asserts that:
 *   1. X is a registered adapter slug
 *   2. Y is one of that adapter's operations
 *
 * Catches the class of bug found in Lane 6.4 (use-cases page had 6 of 7
 * BYOK-only snippets pointing at non-existent slugs/operations and was
 * 404'ing on production).
 *
 * Pattern matched: tool: "slug/operation" where the value is a static
 * string literal (the only kind we can validate at build time). Dynamic
 * cases like `tool: ${variable}/run` are skipped.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, join } from "node:path";
import { describe, expect, it } from "vitest";

// Stub env vars before importing the adapter index — toolroute-adapter
// instantiates Supabase at module load and fails without these.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://test.local";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-key";

const { listAdapters } = await import("@/lib/adapters/index");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = resolve(ROOT, "src/app");

async function findPageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await findPageFiles(full)));
    } else if (entry.isFile() && entry.name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

// Matches both JS object-literal `tool: "X/Y"` and JSON `"tool": "X/Y"` —
// the curl examples in /docs use JSON inside `-d '{...}'` string literals.
const SNIPPET_REGEX = /["']?\btool["']?\s*:\s*["']([a-z0-9-]+)\/([a-z0-9-]+)["']/gi;

/**
 * Legacy broken refs in customer-facing code samples that pre-date this
 * test. New broken refs should NOT be added — fix the snippet instead.
 *
 * Tracked in `.agent/lane-6.4-slug-mismatch-bug.md` (cleanup queue).
 *
 * Format: "<relative-path>:<line>"
 */
const KNOWN_BROKEN_REFS: ReadonlySet<string> = new Set([]);
  // src/app/use-cases/page.tsx — Code Review use case (semgrep adapter
  // doesn't exist; playwright + github operations wrong)
  // Content Pipeline — remotion adapter doesn't exist; postiz op wrong
  // Lead Outreach — apollo op wrong
  // Customer Support Bot — supabase op wrong
  // DevOps Automation — vercel adapter doesn't exist; sentry op wrong
  // Data Enrichment — apollo + supabase ops wrong

interface SnippetReference {
  file: string;
  line: number;
  slug: string;
  operation: string;
}

async function extractSnippetReferences(): Promise<SnippetReference[]> {
  const files = await findPageFiles(APP_DIR);
  const refs: SnippetReference[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      SNIPPET_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SNIPPET_REGEX.exec(line)) !== null) {
        refs.push({
          file: relative(ROOT, file).replace(/\\/g, "/"),
          line: i + 1,
          slug: m[1],
          operation: m[2],
        });
      }
    }
  }
  return refs;
}

describe("page-snippet slug validation (Lane 6.4.1)", () => {
  it("every tool: \"X/Y\" pattern in src/app/**/page.tsx points at a real adapter+operation", async () => {
    const refs = await extractSnippetReferences();
    const adapters = listAdapters();
    const slugMap = new Map(adapters.map((a) => [a.slug, a]));

    const failures: string[] = [];
    const stillBroken = new Set<string>();
    for (const ref of refs) {
      const refKey = `${ref.file}:${ref.line}`;
      const adapter = slugMap.get(ref.slug);
      let isBroken = false;
      let detail = "";
      if (!adapter) {
        isBroken = true;
        detail = `unknown adapter slug "${ref.slug}"`;
      } else if (!adapter.operations.includes(ref.operation)) {
        isBroken = true;
        detail = `adapter "${ref.slug}" has no operation "${ref.operation}" ` +
          `(available: ${adapter.operations.join(", ")})`;
      }
      if (isBroken) {
        if (KNOWN_BROKEN_REFS.has(refKey)) {
          stillBroken.add(refKey);
        } else {
          failures.push(`${refKey} — ${detail}`);
        }
      }
    }

    // Also fail if KNOWN_BROKEN_REFS contains entries that no longer exist —
    // forces the allowlist to shrink as bugs get fixed.
    const obsoleteAllowlistEntries = [...KNOWN_BROKEN_REFS].filter(
      (k) => !stillBroken.has(k)
    );
    if (obsoleteAllowlistEntries.length > 0) {
      failures.push(
        `KNOWN_BROKEN_REFS contains ${obsoleteAllowlistEntries.length} entries ` +
          `that no longer reproduce — remove them:\n` +
          obsoleteAllowlistEntries.map((e) => "    " + e).join("\n")
      );
    }

    if (failures.length > 0) {
      throw new Error(
        `Found ${failures.length} broken tool reference(s) in customer-facing pages:\n` +
          failures.map((f) => "  - " + f).join("\n")
      );
    }

    // Sanity check — if this file ever stops finding any refs, the regex
    // probably broke. Use-cases page should always have several refs.
    expect(refs.length).toBeGreaterThan(0);
  });
});
