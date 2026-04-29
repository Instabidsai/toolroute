import { describe, expect, it } from "vitest";
import { redactCreds } from "@/lib/redact-creds";

describe("redactCreds", () => {
  describe("auth header echoes (Lane 4.17 tail-risk class)", () => {
    it("redacts Bearer tokens from echoed Authorization headers", () => {
      const input =
        'Provider returned 401: {"error":"invalid_token","authorization":"Bearer sk-abc123def456ghi789"}';
      const out = redactCreds(input);
      expect(out).not.toContain("sk-abc123def456ghi789");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts Token scheme (Deepgram-style)", () => {
      const input = "Deepgram error 403: Authorization: Token tok_abc123def456ghi";
      const out = redactCreds(input);
      expect(out).not.toContain("tok_abc123def456ghi");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts DeepL-Auth-Key scheme", () => {
      const input = "DeepL 403: header DeepL-Auth-Key abc123def456ghi789jkl";
      const out = redactCreds(input);
      expect(out).not.toContain("abc123def456ghi789jkl");
      expect(out).toContain("[REDACTED]");
    });
  });

  describe("provider key prefixes", () => {
    it("redacts OpenAI sk- keys", () => {
      const input =
        "OpenAI 401: invalid key sk-1234567890abcdefghijklmnopqrstuv";
      const out = redactCreds(input);
      expect(out).not.toContain("sk-1234567890abcdefghijklmnopqrstuv");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts Anthropic sk-ant- keys", () => {
      const input =
        "Anthropic error: sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
      const out = redactCreds(input);
      expect(out).not.toContain("sk-ant-api03-abcdefghijklmnopqrstuvwxyz");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts xAI xai- keys", () => {
      const input = "xAI auth failure: xai-1234567890abcdefghijklmnop";
      const out = redactCreds(input);
      expect(out).not.toContain("xai-1234567890abcdefghijklmnop");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts Groq gsk_ keys", () => {
      const input = "Groq 401: gsk_1234567890abcdefghijklmnopqrstuv";
      const out = redactCreds(input);
      expect(out).not.toContain("gsk_1234567890abcdefghijklmnopqrstuv");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts Stripe restricted keys (rk_live_/rk_test_)", () => {
      const input = "Stripe error: invalid key rk_live_abc12345";
      const out = redactCreds(input);
      expect(out).not.toContain("rk_live_abc12345");
      expect(out).toContain("[REDACTED]");
    });
  });

  describe("Tavily tvly- keys (Lane 4.76)", () => {
    it("redacts tvly- prefixed keys", () => {
      const input =
        "Tavily 401: invalid key tvly-abc123def456ghi789jkl";
      const out = redactCreds(input);
      expect(out).not.toContain("tvly-abc123def456ghi789jkl");
      expect(out).toContain("[REDACTED]");
    });
  });

  describe("generic api_key=/key= echoes (Lane 4.76 — body-echo class)", () => {
    it("redacts api_key= echoes from request-body-in-response leaks", () => {
      const input =
        'Tavily 500: {"error":"server","api_key":"tvly-abc123def456ghi789jkl"}';
      const out = redactCreds(input);
      expect(out).not.toContain("tvly-abc123def456ghi789jkl");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts unprefixed api_key= when value is long-enough", () => {
      const input =
        'Echo: api_key=somelongplaintextkeyvalue1234';
      const out = redactCreds(input);
      expect(out).not.toContain("somelongplaintextkeyvalue1234");
      expect(out).toContain("[REDACTED]");
    });

    it("does not false-positive on the word 'keyword' or 'keys' in prose", () => {
      const input = "These keys are needed; the keyword is required";
      expect(redactCreds(input)).toBe(input);
    });
  });

  describe("ToolRoute's own customer keys", () => {
    it("redacts tr_live_ keys (production customer keys)", () => {
      const input =
        "Internal error referencing key tr_live_abc123def456ghi789jkl012";
      const out = redactCreds(input);
      expect(out).not.toContain("tr_live_abc123def456ghi789jkl012");
      expect(out).toContain("[REDACTED]");
    });

    it("redacts tr_test_ keys (test customer keys)", () => {
      const input =
        "Test key in error: tr_test_abc123def456ghi789jkl012mno";
      const out = redactCreds(input);
      expect(out).not.toContain("tr_test_abc123def456ghi789jkl012mno");
      expect(out).toContain("[REDACTED]");
    });
  });

  describe("clean strings pass through", () => {
    it("leaves provider error messages without credentials untouched", () => {
      const input = "OpenAI chat failed: 429 rate_limit_exceeded";
      expect(redactCreds(input)).toBe(input);
    });

    it("leaves status-only messages untouched", () => {
      const input = "Provider returned 503 Service Unavailable";
      expect(redactCreds(input)).toBe(input);
    });

    it("returns empty string for null/undefined", () => {
      expect(redactCreds(null)).toBe("");
      expect(redactCreds(undefined)).toBe("");
    });
  });

  describe("truncation belt-and-suspenders", () => {
    it("truncates strings over 1000 chars", () => {
      const input = "x".repeat(2000);
      const out = redactCreds(input);
      expect(out.length).toBeLessThanOrEqual(1000 + "...[truncated]".length);
      expect(out).toContain("...[truncated]");
    });

    it("does not truncate strings under 1000 chars", () => {
      const input = "x".repeat(500);
      expect(redactCreds(input)).toBe(input);
    });
  });

  describe("multiple credentials in one message", () => {
    it("redacts every match independently", () => {
      const input =
        "Cascading auth failure: tr_live_abc123def456ghi789jkl012 wrapping sk-1234567890abcdefghijklmnop";
      const out = redactCreds(input);
      expect(out).not.toContain("tr_live_abc123def456ghi789jkl012");
      expect(out).not.toContain("sk-1234567890abcdefghijklmnop");
      expect(out.match(/\[REDACTED\]/g)?.length).toBe(2);
    });

    it("redacts Bearer + raw key both present", () => {
      const input =
        "Authorization: Bearer sk-abc123def456ghi789jkl012 (key prefix sk-abc123def456ghi789jkl012)";
      const out = redactCreds(input);
      expect(out).not.toContain("sk-abc123def456ghi789jkl012");
      expect(out).toContain("[REDACTED]");
    });
  });
});
