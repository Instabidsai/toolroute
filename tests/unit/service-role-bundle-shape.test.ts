import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");

function listAllSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...listAllSourceFiles(p));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

// Lane 4.26 — service-role JWT bundle exposure drift prevention.
//
// The service_role key is the master key — bypasses RLS, owns every
// table. Three exposure paths:
//   1. Hardcoded JWT in source (pattern eyJ[...]\.[...]\.[...])
//   2. "use client" file importing server-only lib (drags server code
//      into client bundle land — Next.js silently strips env vars but
//      the import surface is wrong)
//   3. NEXT_PUBLIC_* env var name containing service/admin/secret tokens

describe("Lane 4.26 — service-role JWT bundle shape (drift prevention)", () => {
  const allFiles = listAllSourceFiles(SRC_ROOT);

  it("no file under src/ contains a literal JWT", () => {
    const violations: string[] = [];
    // Match the eyJ-prefixed three-segment JWT pattern. Long enough
    // that we don't accidentally match base64-encoded data.
    const jwtPattern = /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;
    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      if (jwtPattern.test(src)) {
        violations.push(relative(process.cwd(), file));
      }
    }
    expect(
      violations,
      `Hardcoded JWT(s) found in src/. Move to env var. Files:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it('no "use client" file imports @/lib/gateway or @/lib/supabase-server (direct or relative)', () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      if (!/['"]use client['"]/.test(src)) continue;

      // Match imports of the two server-only libs. Both `@/lib/...`
      // (next.js path alias) and relative `../lib/...` patterns.
      const importPatterns = [
        /from\s+["']@\/lib\/gateway["']/,
        /from\s+["']@\/lib\/supabase-server["']/,
        /from\s+["'](?:\.\.?\/)+lib\/gateway["']/,
        /from\s+["'](?:\.\.?\/)+lib\/supabase-server["']/,
      ];
      for (const pat of importPatterns) {
        if (pat.test(src)) {
          violations.push(
            `${relative(process.cwd(), file)}: client component imports server-only lib`
          );
        }
      }
    }
    expect(
      violations,
      `Client components importing server-only libs:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("no NEXT_PUBLIC_* env var name contains service|admin|secret|private", () => {
    const violations: string[] = [];
    // Match `NEXT_PUBLIC_<TOKEN>` where TOKEN contains any forbidden
    // sub-token. Case-insensitive on the forbidden side because env
    // vars convention is upper-snake.
    const pat =
      /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE|ADMIN|SECRET|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*/i;
    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      const m = src.match(pat);
      if (m) {
        violations.push(
          `${relative(process.cwd(), file)}: ${m[0]} — public env var name contains forbidden token`
        );
      }
    }
    expect(
      violations,
      `NEXT_PUBLIC_* misnaming:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("SUPABASE_SERVICE_ROLE_KEY references stay under src/app/api, src/app/auth, or src/lib", () => {
    const violations: string[] = [];
    const allowedRoots = [
      join("src", "app", "api"),
      join("src", "app", "auth"),
      join("src", "lib"),
    ];
    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      if (!/SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin\s*\(/.test(src)) continue;

      const rel = relative(process.cwd(), file);
      const isAllowed = allowedRoots.some((root) =>
        rel.startsWith(root + "\\") || rel.startsWith(root + "/")
      );
      // Skip test files and gateway.ts itself (which is at src/lib/gateway.ts).
      if (rel.startsWith("tests" + "\\") || rel.startsWith("tests" + "/")) continue;

      if (!isAllowed) {
        violations.push(
          `${rel}: references service-role key but lives outside src/app/api, src/app/auth, src/lib`
        );
      }
    }
    expect(
      violations,
      `Service-role usage outside server-only roots:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
