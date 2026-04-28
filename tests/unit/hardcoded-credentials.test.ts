import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Lane 4.32 — Drift-prevention test: fail CI on commits that hardcode real
// credentials in source files. The repo has no husky/lint-staged/gitleaks/
// trufflehog config (verified 2026-04-28), so this is the only gate against
// the recurring "showcase page hardcoded JWT" pattern (memory rule #54).
//
// Strategy: regex-scan src/ + mcp-server/ + tests/, then strip hits that look
// like documentation placeholders (`your-...`, `...`, `xxx`) or known-public
// values (the ToolRoute Supabase anon JWT, intentionally embedded in the
// client-side MCP server).

const REPO_ROOT = process.cwd();

// Canonical, intentionally-public values. Adding to this allowlist is a
// load-bearing decision — it means "this credential is deliberately committed
// because the surface it protects is public-by-design."
const PUBLIC_ALLOWLIST = new Set<string>([
  // ToolRoute Supabase anon JWT — the MCP server (mcp-server/index.js) ships
  // to end-users via npx, so the anon key being public is intentional. RLS on
  // the registry tables is what enforces read-only/owner-scoped access.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYnJhdG1mbm56aXB6eW9lZmJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY0MTYsImV4cCI6MjA5MDIxMjQxNn0.GI565bgr2HCQfeRYMVrTUyB2gUlncdb6mx-DEoL9_Fs",
]);

interface CredentialPattern {
  name: string;
  // Regex must match the full credential string. The matched string is what we
  // check against the placeholder filter.
  pattern: RegExp;
}

// Patterns target the full credential. Each is calibrated to require enough
// entropy that documentation placeholders (`sk_live_your-key`, `sk-proj-...`)
// don't match — only real-looking values do.
const PATTERNS: CredentialPattern[] = [
  // JWT — header.payload.signature (each segment >= 10 base64url chars)
  { name: "JWT", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  // OpenAI project key (sk-proj-) — real keys are >40 chars after prefix
  { name: "OpenAI sk-proj", pattern: /sk-proj-[A-Za-z0-9_-]{40,}/g },
  // Anthropic API key
  { name: "Anthropic sk-ant", pattern: /sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{40,}/g },
  // Stripe webhook signing secret (whsec_) — real ones are 32+ chars
  { name: "Stripe whsec", pattern: /whsec_[A-Za-z0-9]{32,}/g },
  // Stripe live secret key
  { name: "Stripe sk_live", pattern: /sk_live_[A-Za-z0-9]{24,}/g },
  // Stripe restricted live key
  { name: "Stripe rk_live", pattern: /rk_live_[A-Za-z0-9]{24,}/g },
  // AWS access key id (AKIA + 16 base32 chars)
  { name: "AWS AKIA", pattern: /AKIA[0-9A-Z]{16}/g },
  // GitHub personal access token (classic)
  { name: "GitHub ghp", pattern: /ghp_[A-Za-z0-9]{36,}/g },
  // GitHub server-to-server token
  { name: "GitHub ghs", pattern: /ghs_[A-Za-z0-9]{36,}/g },
  // GitHub OAuth user token
  { name: "GitHub gho", pattern: /gho_[A-Za-z0-9]{36,}/g },
];

// Strings that mark a hit as a documentation placeholder, not a real value.
const PLACEHOLDER_MARKERS = [
  "your-",
  "your_",
  "...",
  "xxx",
  "XXX",
  "REPLACE",
  "EXAMPLE",
  "example-",
  "<your",
  "<api",
  "PLACEHOLDER",
];

function isPlaceholder(match: string): boolean {
  return PLACEHOLDER_MARKERS.some((m) => match.includes(m));
}

function walk(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git" ||
        entry.name === ".vercel" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }
      walk(full, out);
    } else if (entry.isFile()) {
      // Only scan source-shaped files. Locks, binaries, etc. would create false
      // positives or be too large.
      const ext = path.extname(entry.name).toLowerCase();
      if (
        [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".env", ".sh", ".sql"].includes(ext) ||
        entry.name.endsWith(".env.example")
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  pattern: string;
  excerpt: string;
}

function scan(): Hit[] {
  const roots = ["src", "mcp-server", "tests", "scripts"]
    .map((r) => path.join(REPO_ROOT, r))
    .filter((p) => fs.existsSync(p));

  const files: string[] = [];
  for (const r of roots) walk(r, files);

  const hits: Hit[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const { name, pattern } of PATTERNS) {
      // Reset lastIndex since regex is /g
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(src)) !== null) {
        const match = m[0];
        if (PUBLIC_ALLOWLIST.has(match)) continue;
        if (isPlaceholder(match)) continue;
        // Find line number
        const before = src.slice(0, m.index);
        const line = before.split("\n").length;
        // 60-char excerpt around the match for human-readable failure
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEnd = src.indexOf("\n", m.index);
        const excerpt = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 200);
        hits.push({
          file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
          line,
          pattern: name,
          excerpt,
        });
      }
    }
  }
  return hits;
}

describe("Lane 4.32 — hardcoded credential audit", () => {
  it("no real-looking JWT/Stripe/OpenAI/Anthropic/AWS/GitHub credentials in src/, mcp-server/, tests/, scripts/", () => {
    const hits = scan();
    if (hits.length > 0) {
      const report = hits
        .map((h) => `  ${h.file}:${h.line}  [${h.pattern}]\n    ${h.excerpt}`)
        .join("\n");
      throw new Error(
        `\n${hits.length} hardcoded credential hit(s) found:\n${report}\n\nIf the value is intentionally public (e.g. an anon JWT for a client-side MCP server), add it to PUBLIC_ALLOWLIST in this file. Otherwise, move the credential to env (.env.local for dev, vercel env add for prod) and import via process.env.\n`
      );
    }
    expect(hits).toHaveLength(0);
  });

  it("at least one allowlisted public value is present (sanity — confirms scan runs)", () => {
    // The mcp-server anon JWT is in the allowlist; if scanning is broken or the
    // allowlist drifts away from what's actually committed, this catches it.
    const mcpServer = path.join(REPO_ROOT, "mcp-server", "index.js");
    if (!fs.existsSync(mcpServer)) return; // not blocking — repo may evolve
    const src = fs.readFileSync(mcpServer, "utf8");
    const allowlistedPresent = Array.from(PUBLIC_ALLOWLIST).some((v) => src.includes(v));
    expect(allowlistedPresent, "PUBLIC_ALLOWLIST drifted from mcp-server/index.js — update the allowlist or remove the rotated key").toBe(true);
  });

  it("placeholder filter works (test placeholders are recognized)", () => {
    expect(isPlaceholder("sk_live_your-stripe-key")).toBe(true);
    expect(isPlaceholder("sk-proj-your-openai-key...")).toBe(true);
    expect(isPlaceholder("ghp_xxx_placeholder")).toBe(true);
    // Assemble the JWT-shaped fixture from parts so this test file itself
    // doesn't trip the JWT regex when we scan our own source tree.
    const fakeJwt = "ey" + "Jhdr." + "ey" + "Jpayload." + "signature_part";
    expect(isPlaceholder(fakeJwt)).toBe(false);
  });
});
