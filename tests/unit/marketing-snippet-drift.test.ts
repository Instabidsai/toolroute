// Lane 6.4.4 — drift-prevention test for marketing tool snippets.
//
// Walks every .tsx under src/app/ and asserts every `tool: "..."` literal:
//   1. Uses the slug/op shape that gateway.ts:resolveAdapter requires
//   2. Resolves to a registered adapter and a real adapter operation
//
// Today, this test FAILS — that's intentional. The failures are the canonical
// list of what Lane 6.4.2 + 6.4.3 swap PRs need to fix. As those PRs land,
// the failures shrink to zero. Future regressions then fail CI immediately.
//
// To temporarily silence in CI while sibling lanes ship, set:
//   MARKETING_DRIFT_BASELINE=skip
//
// Cross-refs: .agent/lane-6.4.2-use-cases-snippet-audit.md,
//             .agent/lane-6.4.3-blog-broken-request-shape.md,
//             Hard Rule #57 (pre-launch copy audit before tiered gates).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appDir = resolve(root, "src/app");
const adaptersDir = resolve(root, "src/lib/adapters");

const SHOULD_RUN = process.env.MARKETING_DRIFT_BASELINE !== "skip";

interface AdapterSpec {
  slug: string;
  operations: string[];
}

function loadAdapterRegistry(): Map<string, AdapterSpec> {
  const map = new Map<string, AdapterSpec>();
  const files = readdirSync(adaptersDir).filter((f) => f.endsWith("-adapter.ts"));
  for (const file of files) {
    const src = readFileSync(join(adaptersDir, file), "utf8");
    const slugMatch = src.match(/slug:\s*"([^"]+)"/);
    const opsMatch = src.match(/operations:\s*\[([^\]]+)\]/);
    if (!slugMatch || !opsMatch) continue;
    const operations = [...opsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    map.set(slugMatch[1], { slug: slugMatch[1], operations });
  }
  return map;
}

function findTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...findTsxFiles(full));
    else if (s.isFile() && (name.endsWith(".tsx") || name.endsWith(".ts"))) {
      out.push(full);
    }
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  value: string;
}

function collectHits(): Hit[] {
  const files = findTsxFiles(appDir);
  const hits: Hit[] = [];
  // Captures: "tool":"X"  |  "tool": "X"  |  tool: "X"
  const re = /["']?tool["']?\s*:\s*"([^"\\${}][^"]*)"/g;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(content)) !== null) {
      const value = m[1];
      // Filter prose/variable matches: must look like a slug or slug/op
      if (!/^[a-z][a-z0-9_-]*(\/[a-z][a-z0-9_-]+)*$/.test(value)) continue;
      const line = content.slice(0, m.index).split("\n").length;
      hits.push({ file: relative(appDir, file).replace(/\\/g, "/"), line, value });
    }
  }
  return hits;
}

describe.skipIf(!SHOULD_RUN)("marketing snippet drift", () => {
  it("every tool literal uses slug/op shape (no separate `operation` key)", () => {
    const hits = collectHits();
    const failures = hits
      .filter((h) => !h.value.includes("/"))
      .map((h) => `${h.file}:${h.line} → tool: "${h.value}" (gateway requires slug/op)`);

    expect(failures, `\n${failures.length} shape violation(s):\n${failures.join("\n")}\n`)
      .toEqual([]);
  });

  it("every slug/op tool literal resolves to a registered adapter+op", () => {
    const registry = loadAdapterRegistry();
    const hits = collectHits();
    const failures: string[] = [];

    for (const h of hits) {
      if (!h.value.includes("/")) continue;
      const [slug, ...rest] = h.value.split("/");
      const op = rest.join("/");
      const adapter = registry.get(slug);
      if (!adapter) {
        failures.push(
          `${h.file}:${h.line} → tool: "${h.value}" — slug "${slug}" not registered`
        );
        continue;
      }
      if (!adapter.operations.includes(op)) {
        failures.push(
          `${h.file}:${h.line} → tool: "${h.value}" — op "${op}" not in [${adapter.operations.join(", ")}]`
        );
      }
    }

    expect(failures, `\n${failures.length} resolution failure(s):\n${failures.join("\n")}\n`)
      .toEqual([]);
  });
});
