import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const srcDir = resolve(root, "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (
      entry.endsWith(".ts") ||
      entry.endsWith(".tsx") ||
      entry.endsWith(".js") ||
      entry.endsWith(".jsx")
    )
      files.push(full);
  }
  return files;
}

const KNOWN_PRE_FIX_OFFENDERS = new Set([
  "/src/app/api/v1/byok/route.ts",
  "/src/lib/gateway.ts",
]);

describe("BYOK plaintext guard (Lane 4.36)", () => {
  it("post-fix: no NEW file writes api_key_encrypted: <plaintext> outside known migration sites", () => {
    const offenders: Array<{ file: string; line: number; snippet: string }> =
      [];

    for (const file of walk(srcDir)) {
      const rel = file.replace(root, "").replace(/\\/g, "/");
      if (KNOWN_PRE_FIX_OFFENDERS.has(rel)) continue;

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        if (
          /api_key_encrypted\s*:/.test(line) &&
          !/vault\.|secret_id|encryptedSecretId|ENCRYPTED_BY_VAULT/.test(line)
        ) {
          offenders.push({
            file: rel,
            line: idx + 1,
            snippet: line.trim().slice(0, 140),
          });
        }
      });
    }

    expect(
      offenders,
      `new files writing api_key_encrypted as plaintext:\n${offenders
        .map((o) => `  ${o.file}:${o.line} — ${o.snippet}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("known-offender list still matches reality (catches stale guard)", () => {
    for (const rel of KNOWN_PRE_FIX_OFFENDERS) {
      const abs = resolve(root, rel.replace(/^\//, ""));
      const exists = readdirSync(resolve(abs, "..")).includes(
        rel.split("/").pop()!
      );
      expect(exists, `known offender ${rel} no longer on disk`).toBe(true);
    }
  });
});
