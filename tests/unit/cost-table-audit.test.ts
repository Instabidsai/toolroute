import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const adaptersDir = resolve(root, "src/lib/adapters");
const auditPath = resolve(root, ".agent/cost-table-audit.md");

function adapterSlug(source: string, fileName: string) {
  const match = source.match(/slug:\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`Missing adapter slug in ${fileName}`);
  }
  return match[1];
}

describe("cost table audit", () => {
  it("covers every runtime adapter slug", () => {
    const adapterSlugs = readdirSync(adaptersDir)
      .filter((fileName) => fileName.endsWith("-adapter.ts"))
      .map((fileName) =>
        adapterSlug(readFileSync(resolve(adaptersDir, fileName), "utf8"), fileName)
      )
      .sort();

    const audit = readFileSync(auditPath, "utf8");
    const fullMatrix = audit.split("## Full Adapter Matrix")[1] ?? "";
    const rows = fullMatrix
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .map((line) => line.split("|")[1].trim().replace(/`/g, ""))
      .sort();

    expect(rows).toEqual(adapterSlugs);
  });
});
