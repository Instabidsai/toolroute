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

describe("BYOK plaintext guard (Lane 4.36)", () => {
  it("does not write raw provider keys to user_provider_keys.api_key_encrypted", () => {
    const offenders: Array<{ file: string; line: number; snippet: string }> =
      [];

    for (const file of walk(srcDir)) {
      const rel = file.replace(root, "").replace(/\\/g, "/");

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        if (
          /api_key_encrypted\s*:/.test(line) &&
          !/encryptSecret|encryptedApiKey|vault\.|secret_id|encryptedSecretId|ENCRYPTED_BY_VAULT/.test(line)
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
      `files writing api_key_encrypted without encryption:\n${offenders
        .map((o) => `  ${o.file}:${o.line} — ${o.snippet}`)
        .join("\n")}`
    ).toEqual([]);
  });
});
