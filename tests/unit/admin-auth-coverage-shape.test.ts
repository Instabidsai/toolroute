import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");
const ADMIN_ROOT = join(SRC_ROOT, "app", "api", "admin");
const API_ROOT = join(SRC_ROOT, "app", "api");

function listRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...listRouteFiles(p));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(p);
    }
  }
  return out;
}

function listAllSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
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

// Match each exported HTTP handler block. Capture method name +
// body. Body runs from `{` after the args list to the matching `}`
// at column 0 (Next.js route convention — top-level handlers).
function extractHandlerBlocks(
  src: string
): Array<{ method: string; body: string; startIdx: number }> {
  const out: Array<{ method: string; body: string; startIdx: number }> = [];
  const headerPat =
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = headerPat.exec(src)) !== null) {
    const method = m[1];
    const headerStart = m.index;
    // Find the opening `{` after the closing `)` of the args list.
    const openParenIdx = src.indexOf("(", headerStart);
    let depth = 1;
    let i = openParenIdx + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    // i now points just past the closing `)` of args.
    const openBraceIdx = src.indexOf("{", i);
    if (openBraceIdx === -1) continue;
    // Find matching `}` at column 0.
    const after = src.slice(openBraceIdx + 1);
    const closeRel = after.search(/^\}/m);
    if (closeRel === -1) continue;
    const body = after.slice(0, closeRel);
    out.push({ method, body, startIdx: openBraceIdx });
  }
  return out;
}

// Lane 4.28 — admin endpoint authorization coverage drift prevention.
//
// Every non-OPTIONS handler under src/app/api/admin/** must call
// validateAdmin(request) BEFORE any DB access. validateAdmin must
// use timingSafeEqual. No admin functionality may leak outside
// src/app/api/admin/.

describe("Lane 4.28 — admin endpoint authorization coverage (drift prevention)", () => {
  const adminRoutes = listRouteFiles(ADMIN_ROOT);

  it("at least one admin route exists (sanity)", () => {
    expect(adminRoutes.length).toBeGreaterThan(0);
  });

  it("every admin route file references validateAdmin", () => {
    const violations: string[] = [];
    for (const file of adminRoutes) {
      const src = readFileSync(file, "utf8");
      if (!/validateAdmin/.test(src)) {
        violations.push(relative(process.cwd(), file));
      }
    }
    expect(
      violations,
      `Admin route file does not reference validateAdmin:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("every non-OPTIONS handler in admin routes calls validateAdmin BEFORE any DB call", () => {
    const violations: string[] = [];
    for (const file of adminRoutes) {
      const src = readFileSync(file, "utf8");
      const handlers = extractHandlerBlocks(src);
      for (const h of handlers) {
        if (h.method === "OPTIONS" || h.method === "HEAD") continue;
        const validateIdx = h.body.search(/validateAdmin\s*\(/);
        const dbIdx = h.body.search(
          /(?:supabaseAdmin\s*\(|\bsb\.(?:from|rpc|auth)\s*[(.]|\bsupabase\.(?:from|rpc)\s*\()/
        );
        if (validateIdx === -1) {
          violations.push(
            `${relative(process.cwd(), file)} :: ${h.method} — no validateAdmin() call`
          );
          continue;
        }
        if (dbIdx !== -1 && dbIdx < validateIdx) {
          violations.push(
            `${relative(process.cwd(), file)} :: ${h.method} — DB call appears BEFORE validateAdmin (idx ${dbIdx} < ${validateIdx})`
          );
        }
      }
    }
    expect(
      violations,
      `Admin handlers missing or mis-ordered auth gate:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("validateAdmin (inline or imported) uses timingSafeEqual for constant-time comparison", () => {
    const violations: string[] = [];
    for (const file of adminRoutes) {
      const src = readFileSync(file, "utf8");
      const hasInlineDef = /function\s+validateAdmin\s*\(/.test(src);
      const hasCentralImport = /from\s+["']@\/lib\/admin-auth["']/.test(src);

      if (hasInlineDef) {
        // Inline definition must use timingSafeEqual.
        if (!/timingSafeEqual\s*\(/.test(src)) {
          violations.push(
            `${relative(process.cwd(), file)}: inline validateAdmin missing timingSafeEqual — vulnerable to timing-attack secret enumeration`
          );
        }
      } else if (hasCentralImport) {
        // Imported from src/lib/admin-auth — verify central impl uses timingSafeEqual.
        const central = join(SRC_ROOT, "lib", "admin-auth.ts");
        if (existsSync(central)) {
          const csrc = readFileSync(central, "utf8");
          if (!/timingSafeEqual\s*\(/.test(csrc)) {
            violations.push(
              `src/lib/admin-auth.ts (imported by ${relative(process.cwd(), file)}) missing timingSafeEqual`
            );
          }
        }
      } else {
        violations.push(
          `${relative(process.cwd(), file)}: no inline validateAdmin def AND no import from @/lib/admin-auth — auth fn source unknown`
        );
      }
    }
    expect(
      violations,
      `Constant-time secret comparison missing or central impl unverifiable:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("no admin-secret references leak outside src/app/api/admin/", () => {
    const allFiles = listAllSourceFiles(SRC_ROOT);
    const violations: string[] = [];
    const adminPathFragments = [
      join("src", "app", "api", "admin"),
      join("src", "lib", "admin-auth"),
    ];
    for (const file of allFiles) {
      const rel = relative(process.cwd(), file);
      const inAdminTree = adminPathFragments.some(
        (frag) => rel.includes(frag)
      );
      if (inAdminTree) continue;
      const src = readFileSync(file, "utf8");
      if (/TOOLROUTE_ADMIN_SECRET|x-admin-secret/i.test(src)) {
        violations.push(rel);
      }
    }
    expect(
      violations,
      `Admin secret/header referenced outside src/app/api/admin/ or src/lib/admin-auth:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("no admin-class routes exist outside src/app/api/admin/", () => {
    const allRoutes = listRouteFiles(API_ROOT);
    const violations: string[] = [];
    for (const file of allRoutes) {
      const rel = relative(process.cwd(), file);
      const inAdminTree =
        rel.includes(join("api", "admin")) ||
        rel.includes(join("api/admin"));
      if (inAdminTree) continue;
      const src = readFileSync(file, "utf8");
      // Flag any non-admin-tree route that uses validateAdmin or
      // checks x-admin-secret — that's an admin-class route in the
      // wrong location.
      if (
        /validateAdmin\s*\(/.test(src) ||
        /["']x-admin-secret["']/i.test(src)
      ) {
        violations.push(rel);
      }
    }
    expect(
      violations,
      `Admin-class auth check found in non-admin route file:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
