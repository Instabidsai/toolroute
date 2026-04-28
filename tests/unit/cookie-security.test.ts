import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(process.cwd(), "src");
const HELPER_PATH = resolve(SRC, "lib/cookie-security.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = `${dir}${sep}${entry}`;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("cookie security drift guard", () => {
  it("setSecureCookie helper exists and enforces required flags", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    expect(src).toMatch(/export\s+function\s+setSecureCookie/);
    expect(src).toMatch(/httpOnly:\s*true/);
    expect(src).toMatch(/sameSite:\s*options\.sameSite\s*\?\?\s*"lax"/);
    expect(src).toMatch(/path:\s*options\.path\s*\?\?\s*"\/"/);
    expect(src).toMatch(/secure:\s*options\.secure\s*\?\?/);
  });

  it("deleteSecureCookie helper exists and forces maxAge:0 + httpOnly", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    expect(src).toMatch(/export\s+function\s+deleteSecureCookie/);
    expect(src).toMatch(/maxAge:\s*0/);
    expect(src).toMatch(/httpOnly:\s*true/);
  });

  it("no .cookies.set( call site outside src/lib/cookie-security.ts", () => {
    const files = walk(SRC);
    const offenders: { file: string; lines: number[] }[] = [];

    for (const file of files) {
      if (file.endsWith(`lib${sep}cookie-security.ts`)) continue;

      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      const matches: number[] = [];

      lines.forEach((line, idx) => {
        if (/\.cookies\.set\s*\(/.test(line)) {
          matches.push(idx + 1);
        }
      });

      if (matches.length > 0) {
        offenders.push({ file: file.replace(process.cwd(), ""), lines: matches });
      }
    }

    expect(
      offenders,
      `Direct .cookies.set() outside cookie-security.ts (route session cookies through setSecureCookie / deleteSecureCookie):\n${offenders
        .map((o) => `  ${o.file}: lines ${o.lines.join(", ")}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("auth callback route imports setSecureCookie", () => {
    const callback = resolve(SRC, "app/auth/callback/route.ts");
    const src = readFileSync(callback, "utf8");
    expect(src).toMatch(/from\s+"@\/lib\/cookie-security"/);
    expect(src).toMatch(/setSecureCookie\s*\(/);
  });
});
