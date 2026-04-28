import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const srcDir = resolve(root, "src");

const RISKY_IDENTIFIERS = [
  "apiKey",
  "api_key",
  "apikey",
  "API_KEY",
  "jwt",
  "JWT",
  "token",
  "TOKEN",
  "secret",
  "SECRET",
  "password",
  "bearer",
  "Bearer",
  "authHeader",
  "auth_header",
  "service_role",
  "SERVICE_ROLE",
  "master_key",
  "supabaseKey",
  "anon_key",
  "encryptionKey",
];

const RISKY_ENV_VARS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "ELEVENLABS_API_KEY",
  "VAPI_API_KEY",
  "TWILIO_AUTH_TOKEN",
];

const ALLOWED_VARIABLES_AS_SUBSTRING = new Set([
  "deductResult",
  "tokenize",
  "tokenizer",
  "validateToken",
  "encryptionAlgorithm",
]);

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

const CONSOLE_CALL_RE =
  /console\.(?:log|warn|error|info|debug)\s*\(([\s\S]*?)\)\s*[;,\n]/g;

function findRiskyConsoleCalls(): Array<{
  file: string;
  line: number;
  args: string;
  reason: string;
}> {
  const findings: Array<{
    file: string;
    line: number;
    args: string;
    reason: string;
  }> = [];

  for (const file of walk(srcDir)) {
    const source = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    CONSOLE_CALL_RE.lastIndex = 0;
    while ((match = CONSOLE_CALL_RE.exec(source)) !== null) {
      const args = match[1];
      const offset = match.index;
      const line = source.slice(0, offset).split("\n").length;

      for (const env of RISKY_ENV_VARS) {
        if (args.includes(`process.env.${env}`)) {
          findings.push({
            file: file.replace(root, ""),
            line,
            args: args.trim().slice(0, 120),
            reason: `direct process.env.${env} reference`,
          });
        }
      }

      for (const id of RISKY_IDENTIFIERS) {
        const re = new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`);
        if (re.test(args) && !ALLOWED_VARIABLES_AS_SUBSTRING.has(id)) {
          findings.push({
            file: file.replace(root, ""),
            line,
            args: args.trim().slice(0, 120),
            reason: `risky identifier "${id}" as bare reference`,
          });
        }
      }
    }
  }
  return findings;
}

describe("console log redaction", () => {
  it("no console.* call references a known credential identifier or env var", () => {
    const findings = findRiskyConsoleCalls();
    expect(
      findings,
      `risky console calls:\n${findings
        .map((f) => `  ${f.file}:${f.line} — ${f.reason} — ${f.args}`)
        .join("\n")}`
    ).toEqual([]);
  });
});
