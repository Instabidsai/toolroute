import { describe, it, expect } from "vitest";
import { assertSafePublicUrl, SSRFError } from "../../src/lib/ssrf-guard";

// Lane 4.31 — SSRF guard unit tests + drift-prevention shape test for
// adapters that fetch user-supplied URLs.

describe("Lane 4.31 — SSRF guard", () => {
  describe("blocks dangerous URLs", () => {
    const blocked = [
      "http://169.254.169.254/latest/meta-data/",          // AWS/Vercel/GCP metadata
      "http://169.254.169.254",
      "http://127.0.0.1:8080/internal",
      "http://127.5.5.5/",
      "http://localhost:5432",
      "http://10.0.0.1/",
      "http://10.255.255.255/",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://192.168.1.1/admin",
      "http://0.0.0.0/",
      "http://[::1]/",
      "http://[fe80::1]/",
      "http://[fc00::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://metadata.google.internal/",
      "file:///etc/passwd",
      "data:text/plain;base64,SGVsbG8=",
      "ftp://example.com/",
      "gopher://example.com/",
    ];

    for (const url of blocked) {
      it(`refuses ${url}`, () => {
        expect(() => assertSafePublicUrl(url)).toThrow(SSRFError);
      });
    }
  });

  describe("allows safe public URLs", () => {
    const safe = [
      "https://example.com/",
      "https://api.openai.com/v1/chat/completions",
      "http://www.example.org/path?q=1",
      "https://8.8.8.8/",                       // public IP
      "https://[2606:4700:4700::1111]/",        // public IPv6 (cloudflare)
    ];

    for (const url of safe) {
      it(`accepts ${url}`, () => {
        expect(() => assertSafePublicUrl(url)).not.toThrow();
      });
    }
  });

  it("rejects malformed URLs", () => {
    expect(() => assertSafePublicUrl("not a url")).toThrow(SSRFError);
    expect(() => assertSafePublicUrl("")).toThrow(SSRFError);
  });
});

describe("Lane 4.31 — SSRF drift prevention across adapters", () => {
  // Adapters that fetch user-supplied URLs DIRECTLY (not via provider API):
  // require assertSafePublicUrl OR equivalent guard before fetch().
  it("playwright/scrape-text guards user URL with assertSafePublicUrl", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/adapters/playwright-adapter.ts"),
      "utf8"
    );

    // The scrape-text branch must contain assertSafePublicUrl BEFORE the
    // network call. fetchWithTimeout wraps native fetch after Lane 4.138.
    const scrapeBlockMatch = src.match(
      /operation === "scrape-text"[\s\S]*?(?=if\s*\(\s*operation === )/
    );
    expect(scrapeBlockMatch, "scrape-text branch not found").not.toBeNull();
    const scrapeBlock = scrapeBlockMatch![0];

    const guardIdx = scrapeBlock.search(/assertSafePublicUrl\s*\(/);
    const fetchIdx = scrapeBlock.search(/await\s+(?:fetch|fetchWithTimeout)\s*\(\s*url\b/);

    expect(guardIdx, "assertSafePublicUrl must be called in scrape-text").toBeGreaterThan(-1);
    expect(fetchIdx, "fetch(url, ...) must exist in scrape-text").toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(fetchIdx);
  });
});
