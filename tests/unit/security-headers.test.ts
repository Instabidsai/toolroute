import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const NEXT_CONFIG = resolve(process.cwd(), "next.config.ts");

const REQUIRED_HEADERS = [
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "Permissions-Policy",
] as const;

function loadConfig(): string {
  return readFileSync(NEXT_CONFIG, "utf8");
}

function findGlobalBlock(source: string): string {
  const idx = source.indexOf('source: "/(.*)"');
  if (idx === -1) {
    throw new Error('next.config.ts is missing the global source: "/(.*)" headers block');
  }
  // Walk forward, tracking brace depth, until the outer object closes.
  // The block opens with `{ source: ..., headers: [...] }` so we step back
  // to the opening brace, then find the matching closer.
  let openBrace = idx;
  while (openBrace > 0 && source[openBrace] !== "{") openBrace--;
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  throw new Error("next.config.ts global headers block has unbalanced braces");
}

describe("security headers drift guard (next.config.ts)", () => {
  const config = loadConfig();
  const globalBlock = findGlobalBlock(config);

  for (const header of REQUIRED_HEADERS) {
    it(`global headers include ${header}`, () => {
      const pattern = new RegExp(
        `key:\\s*"${header.replace(/[-]/g, "\\-")}"`,
        "i"
      );
      expect(pattern.test(globalBlock)).toBe(true);
    });
  }

  it("HSTS is at least one year with includeSubDomains", () => {
    const match = globalBlock.match(
      /key:\s*"Strict-Transport-Security",\s*value:\s*"([^"]+)"/i
    );
    expect(match).not.toBeNull();
    const value = match![1];
    const ageMatch = value.match(/max-age=(\d+)/);
    expect(ageMatch).not.toBeNull();
    const seconds = Number(ageMatch![1]);
    expect(seconds).toBeGreaterThanOrEqual(31536000);
    expect(value).toMatch(/includeSubDomains/i);
  });

  it("X-Frame-Options is DENY (prevents clickjacking)", () => {
    expect(globalBlock).toMatch(/key:\s*"X-Frame-Options",\s*value:\s*"DENY"/i);
  });

  it("CSP forbids embedding via frame-ancestors 'none'", () => {
    const match = globalBlock.match(
      /key:\s*"Content-Security-Policy"[\s\S]*?value:\s*\[([\s\S]*?)\]\.join/i
    );
    expect(match).not.toBeNull();
    const cspBody = match![1];
    expect(cspBody).toMatch(/frame-ancestors\s+'none'/i);
  });

  it("CSP locks object-src to 'none' (prevents legacy plugin XSS)", () => {
    const match = globalBlock.match(
      /key:\s*"Content-Security-Policy"[\s\S]*?value:\s*\[([\s\S]*?)\]\.join/i
    );
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/object-src\s+'none'/i);
  });

  it("Permissions-Policy disables camera, microphone, geolocation", () => {
    const match = globalBlock.match(
      /key:\s*"Permissions-Policy"[\s\S]*?value:\s*\[([\s\S]*?)\]\.join/i
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/camera=\(\)/);
    expect(body).toMatch(/microphone=\(\)/);
    expect(body).toMatch(/geolocation=\(\)/);
  });

  it("Referrer-Policy is at least strict-origin-when-cross-origin", () => {
    const allowed = new Set([
      "no-referrer",
      "same-origin",
      "strict-origin",
      "strict-origin-when-cross-origin",
    ]);
    const match = globalBlock.match(
      /key:\s*"Referrer-Policy",\s*value:\s*"([^"]+)"/i
    );
    expect(match).not.toBeNull();
    expect(allowed.has(match![1])).toBe(true);
  });
});
