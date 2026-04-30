import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.134 — drift guard: every admin/* HTTP method handler MUST call
// validateAdmin() before doing any work.
//
// Sibling guards:
//   - Lane 4.11: validateAdmin() extraction (timing-safe header compare)
//   - Lane 4.28: one-shot manual admin auth-coverage audit
//   - Lane 4.33 + 4.116: route-auth-coverage (every route declares an auth
//     class banner; admin/* routes are classified "admin")
//   - Lane 4.106: tool_providers admin POST gated to 410 Gone via env flag
//   - Lane 4.132: supabaseAdmin() callsite allow-list (lib-layer)
//
// What this lane closes:
//
// Lane 4.28 was a one-shot audit confirming every admin handler calls
// validateAdmin. Without CI enforcement, a future PR can add
// `src/app/api/admin/<new>/route.ts` that forgets the gate — secret-
// header bypass becomes a public-internet admin endpoint. Memory
// rule #59: ship a failing-snapshot drift guard so future drift
// trips CI instead of silently shipping.
//
// Drift class:
//   - Add new admin handler that omits validateAdmin → trips test #2.
//   - Forget the import on a new file → trips test #1.
//
// Source-file regex parser per memory rule #59 — never import runtime
// modules in tests; they pull createClient() and crash without prod
// env. Comment-strip pass before regex check (rule #59 hygiene) so
// JSDoc references like `// validateAdmin()` in a code example don't
// false-positive.

const SRC_ROOT = resolve(process.cwd(), "src");
const ADMIN_ROOT = resolve(SRC_ROOT, "app", "api", "admin");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (st.isFile() && full.endsWith("route.ts")) {
      files.push(full);
    }
  }
  return files;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

// Extract the body (text between matched braces) of an exported HTTP
// handler. Returns null if the handler isn't exported in this file.
//
// We DON'T require validateAdmin to be the first statement — Lane 4.106
// gates admin/providers POST behind ENABLE_TOOL_PROVIDERS_ADMIN with a
// 410 Gone return BEFORE validateAdmin runs (intentional). What matters
// is that validateAdmin is reachable on every code path that does real
// work; a 410-Gone-then-validateAdmin pattern is fine.
function extractHandlerBody(src: string, method: string): string | null {
  const re = new RegExp(
    `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{`,
    "g"
  );
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  let inString: '"' | "'" | "`" | null = null;
  let escape = false;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (escape) {
      escape = false;
    } else if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === inString) inString = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
    i++;
  }
  if (depth !== 0) return null;
  return src.slice(start, i - 1);
}

const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

describe("Lane 4.134 — admin/* validateAdmin() coverage drift guard", () => {
  const files = walk(ADMIN_ROOT);

  it("at least one admin route file exists (sanity)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every admin route file imports validateAdmin from @/lib/admin-auth", () => {
    const violators: string[] = [];
    const reImport =
      /import\s*\{[^}]*\bvalidateAdmin\b[^}]*\}\s*from\s*["']@\/lib\/admin-auth["']/;
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      const src = stripComments(readFileSync(file, "utf-8"));
      if (!reImport.test(src)) {
        violators.push(rel);
      }
    }
    expect(violators).toEqual([]);
  });

  it("every exported HTTP method handler in admin/* calls validateAdmin(", () => {
    const violators: { file: string; method: string }[] = [];
    const reCall = /\bvalidateAdmin\s*\(/;
    for (const file of files) {
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      const src = stripComments(readFileSync(file, "utf-8"));
      for (const method of HTTP_METHODS) {
        const body = extractHandlerBody(src, method);
        if (body === null) continue; // method not exported by this file
        if (!reCall.test(body)) {
          violators.push({ file: rel, method });
        }
      }
    }
    expect(violators).toEqual([]);
  });
});
