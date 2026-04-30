import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Lane 4.139 — drift guard: log_gateway_request p_error redaction.
//
// Lane 4.131 (gateway-rpc-callsite-allowlist.test.ts) gates the callsite
// LOCATION — `log_gateway_request` may only be called from gateway.ts.
// What it does NOT gate: the SHAPE of the `p_error` argument.
//
// Today, gateway.ts has 2 callsites and both correctly redact:
//   gateway.ts:411 — `p_error: errMsg` where errMsg comes from
//                    `redactCreds(err instanceof Error ? err.message : String(err))`
//                    at line 394 (catch block).
//   gateway.ts:467 — `p_error: result.error ? redactCreds(result.error) : null`.
//
// Drift class this lane closes: a future refactor inside gateway.ts (the
// only allow-listed file) adds a third callsite that bypasses the wrap.
// The error string flows from `adapter.execute()` and may contain raw
// upstream creds (Bearer tokens, sk-* keys, etc.) — landing them
// permanently in gateway_usage_log.error_message would be a long-lived
// PII/credential leak surface (Lane 4.17 / 4.18 class), and the row is
// readable to the owner via /api/v1/usage + /dashboard/usage.
//
// This guard is pass-today / enforce-from-day-one — no swap PR needed.
//
// Sibling guards: Lane 4.131 (callsite locality), Lane 4.136 (adapter
// redactCreds coverage), Lane 4.137 (auto-adapter execMessage redact).
//
// Source-file regex parser (NOT runtime import) — registry imports often
// pull in createClient and crash without prod env (memory rule #59).

const SRC_ROOT = resolve(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (
      st.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx")
    ) {
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

// Capture everything between `.rpc("log_gateway_request",` and the
// outermost `})`. Greedy until balance hits zero — supabase-js call
// shape is `sb.rpc("log_gateway_request", { ...named args... })`, so
// the first `}` closes the args object, and the next `)` closes .rpc().
function extractRpcArgBlocks(src: string): string[] {
  const cleaned = stripComments(src);
  const blocks: string[] = [];
  const re = /\.rpc\(\s*["']log_gateway_request["']\s*,\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    let depth = 1;
    let i = re.lastIndex; // position right after the opening `{`
    while (i < cleaned.length && depth > 0) {
      const ch = cleaned[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    if (depth === 0) {
      blocks.push(cleaned.slice(re.lastIndex, i - 1));
    }
  }
  return blocks;
}

// Find the value expression assigned to `p_error:` inside an args block.
// Returns the raw value string (right-trimmed at the next top-level comma
// or at end of block).
function extractPError(argsBlock: string): string | null {
  // Match `p_error:` then capture up to the next top-level `,` or end.
  // Top-level = depth 0 in (), [], {}, ``, "", ''.
  const idx = argsBlock.search(/\bp_error\s*:/);
  if (idx < 0) return null;
  // Move past `p_error:`
  let i = argsBlock.indexOf(":", idx) + 1;
  // Skip leading whitespace
  while (i < argsBlock.length && /\s/.test(argsBlock[i])) i++;
  const start = i;
  let depth = 0;
  let inStr: string | null = null;
  while (i < argsBlock.length) {
    const ch = argsBlock[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
      else if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
      else if (ch === "," && depth === 0) break;
    }
    i++;
  }
  return argsBlock.slice(start, i).trim();
}

describe("Lane 4.139 — log_gateway_request p_error redactCreds drift guard", () => {
  const files = walk(SRC_ROOT);

  it("every log_gateway_request callsite passes p_error through redactCreds (or null)", () => {
    // Acceptable shapes for p_error:
    //   - `null`                                 — explicit no-error path
    //   - `redactCreds(...)`                     — direct wrap
    //   - `<ident> ? redactCreds(...) : null`    — gateway.ts:467 shape
    //   - any reference to a local that itself was redacted earlier in
    //     the same scope (e.g. `errMsg` at gateway.ts:411 where line 394
    //     binds `const errMsg = redactCreds(...)`).
    //
    // The third case is a tradeoff: a strict regex can't follow control
    // flow without a proper parser. We accept any value that EITHER
    // contains the literal `redactCreds` OR is exactly `null`. The
    // local-binding case is covered if the file *itself* imports
    // redactCreds — i.e. the variable came from a local redact. Files
    // that don't import redactCreds at all but pass a non-null value
    // are violators.
    const violators: { file: string; pError: string }[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (!/\.rpc\(\s*["']log_gateway_request["']/.test(src)) continue;
      const rel = file.replace(SRC_ROOT, "src").replace(/\\/g, "/");
      const cleaned = stripComments(src);
      const importsRedact = /\bredactCreds\b/.test(cleaned);

      const blocks = extractRpcArgBlocks(src);
      for (const block of blocks) {
        const pError = extractPError(block);
        if (pError === null) {
          // Defensive: if a callsite somehow omits p_error entirely,
          // the RPC default (NULL) takes over — that's the safe path,
          // skip.
          continue;
        }
        const isNull = /^null\b/.test(pError);
        const wrapsRedact = /\bredactCreds\s*\(/.test(pError);
        // If the value references redactCreds directly, accept.
        // If null literal, accept.
        // Otherwise: file must import/use redactCreds AND the p_error
        // value must be a bare identifier (suggesting a redacted local).
        const looksLikeBareIdent = /^[A-Za-z_$][\w$]*$/.test(pError);
        const accepted =
          isNull ||
          wrapsRedact ||
          (looksLikeBareIdent && importsRedact);

        if (!accepted) {
          violators.push({ file: rel, pError });
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("at least one log_gateway_request callsite exists (sanity)", () => {
    // If gateway.ts is renamed or the RPC is removed without updating
    // this guard, the test would silently pass. Sanity-pin the count.
    let count = 0;
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      const matches = src.match(/\.rpc\(\s*["']log_gateway_request["']/g);
      if (matches) count += matches.length;
    }
    // Today: 2 (error path + success path in gateway.ts).
    // Pin at >= 1 so a single-call refactor doesn't false-positive,
    // but a total-removal refactor flags here.
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
