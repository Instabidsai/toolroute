import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lane 4.81 — drift guard for the master-key-in-URL leak class
 * documented in `.agent/lane-4.80-screenshot-master-key-url-leak.md`.
 *
 * Leak signature: an adapter constructs a URL via URLSearchParams that
 * embeds a credential-named param (api_key|access_key|apiKey|key) AND
 * returns that URL to the caller in a *_url field on `data`.
 *
 * `screenshot-adapter.ts` is the known offender pending Codex ticket
 * lane-4.80-impl (HMAC-signed URLs). All OTHER adapters must remain
 * clean. New adapter PRs that introduce this pattern fail this test
 * before they can ship.
 */

const ADAPTERS_DIR = resolve(process.cwd(), "src/lib/adapters");

const KNOWN_LEAKERS = new Set<string>([
  // pending Codex impl ticket lane-4.80-impl — HMAC-signed URLs
  "screenshot-adapter.ts",
]);

const CRED_PARAM_NAMES = ["api_key", "access_key", "apiKey", "key"];
const URL_FIELD_NAMES = [
  "image_url",
  "video_url",
  "audio_url",
  "pdf_url",
  "file_url",
  "download_url",
  "result_url",
  "asset_url",
  "preview_url",
];

function listAdapterFiles(): string[] {
  return readdirSync(ADAPTERS_DIR).filter(
    (f) => f.endsWith("-adapter.ts") && !f.endsWith(".test.ts")
  );
}

/**
 * Returns true if the source builds a URLSearchParams instance that includes
 * one of the credential-named params bound to the apiKey variable, then
 * concatenates that into a URL string.
 *
 * We scan the file as a single block — the leak signature spans multiple
 * lines but always has these markers within ~50 lines of each other.
 */
function hasCredInUrlParams(src: string): boolean {
  for (const param of CRED_PARAM_NAMES) {
    // Match e.g.  access_key: apiKey   or   api_key: apiKey
    const pattern = new RegExp(
      `URLSearchParams\\s*\\(\\s*\\{[^}]*\\b${param}\\s*:\\s*apiKey\\b`,
      "s"
    );
    if (pattern.test(src)) return true;
  }
  return false;
}

/**
 * Returns true if a `*_url:` field in a return data object is assigned a
 * variable whose name suggests it's the URL constructed above.
 */
function returnsConstructedUrl(src: string): boolean {
  for (const field of URL_FIELD_NAMES) {
    const pattern = new RegExp(
      `\\b${field}\\s*:\\s*(screenshotUrl|imageUrl|fileUrl|downloadUrl|resultUrl|assetUrl|previewUrl|videoUrl|audioUrl|pdfUrl|url)\\b`,
      "g"
    );
    if (pattern.test(src)) return true;
  }
  return false;
}

describe("adapter URL-cred-leak drift guard (Lane 4.81)", () => {
  it("no non-allowlisted adapter embeds a credential param in a URLSearchParams", () => {
    const violations: string[] = [];
    for (const file of listAdapterFiles()) {
      if (KNOWN_LEAKERS.has(file)) continue;
      const src = readFileSync(resolve(ADAPTERS_DIR, file), "utf8");
      if (hasCredInUrlParams(src)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no non-allowlisted adapter both embeds creds in URL AND returns the URL to caller", () => {
    const violations: string[] = [];
    for (const file of listAdapterFiles()) {
      if (KNOWN_LEAKERS.has(file)) continue;
      const src = readFileSync(resolve(ADAPTERS_DIR, file), "utf8");
      if (hasCredInUrlParams(src) && returnsConstructedUrl(src)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("KNOWN_LEAKERS allowlist is non-empty and points to real files", () => {
    expect(KNOWN_LEAKERS.size).toBeGreaterThan(0);
    const adapters = new Set(listAdapterFiles());
    for (const f of KNOWN_LEAKERS) {
      expect(adapters.has(f)).toBe(true);
    }
  });

  it("KNOWN_LEAKERS still actually leak (test the test — guards against premature allowlist removal)", () => {
    for (const f of KNOWN_LEAKERS) {
      const src = readFileSync(resolve(ADAPTERS_DIR, f), "utf8");
      expect(hasCredInUrlParams(src)).toBe(true);
    }
  });
});
