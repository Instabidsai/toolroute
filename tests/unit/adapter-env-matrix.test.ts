import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const adaptersDir = resolve(root, "src/lib/adapters");
const matrixPath = resolve(root, ".agent/adapter-env-matrix.md");

function adapterSlug(source: string, fileName: string) {
  const match = source.match(/slug:\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`Missing adapter slug in ${fileName}`);
  }
  return match[1];
}

function envVarsFrom(source: string) {
  const matches = source.matchAll(/process\.env\.([A-Za-z0-9_]+)/g);
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

describe("adapter env-var matrix", () => {
  it("lists every adapter and every process.env reference", () => {
    const adapterFiles = readdirSync(adaptersDir)
      .filter((fileName) => fileName.endsWith("-adapter.ts"))
      .sort();
    const matrix = readFileSync(matrixPath, "utf8");
    const rows = matrix
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Adapter"))
      .filter((line) => !line.startsWith("|---"));
    const rowBySlug = new Map(
      rows.map((row) => {
        const cells = row.split("|").map((cell) => cell.trim());
        return [cells[1], row] as const;
      })
    );

    const adapterSources = new Map(
      adapterFiles.map((fileName) => [
        fileName,
        readFileSync(resolve(adaptersDir, fileName), "utf8"),
      ])
    );
    const adapterSlugs = adapterFiles
      .map((fileName) => adapterSlug(adapterSources.get(fileName)!, fileName))
      .sort();

    expect([...rowBySlug.keys()].sort()).toEqual(adapterSlugs);

    for (const fileName of adapterFiles) {
      const source = adapterSources.get(fileName)!;
      const slug = adapterSlug(source, fileName);
      const row = rowBySlug.get(slug);
      expect(row, `${slug} row missing`).toBeTruthy();

      for (const envVar of envVarsFrom(source)) {
        expect(row, `${slug} missing ${envVar}`).toContain(`\`${envVar}\``);
      }
    }
  });
});
