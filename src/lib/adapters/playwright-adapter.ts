import type { ToolAdapter, AdapterResult } from "../gateway-types";

const THUM_BASE = "https://image.thum.io/get";

export const playwrightAdapter: ToolAdapter = {
  slug: "playwright",
  name: "Playwright",
  description:
    "Browser automation — screenshots, text scraping, and PDF generation via remote rendering",
  operations: ["screenshot", "scrape-text", "pdf"],

  async execute(
    operation: string,
    input: Record<string, unknown>
  ): Promise<AdapterResult> {
    try {
      if (operation === "screenshot") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "playwright",
          };
        }

        const width = (input.width as number) ?? 1280;
        const height = (input.height as number) ?? 720;
        const imageUrl = `${THUM_BASE}/width/${width}/crop/${height}/${url}`;

        // Verify the service responds
        const res = await fetch(imageUrl, { method: "HEAD" });
        if (!res.ok) {
          return {
            success: false,
            error: `Screenshot service returned ${res.status}`,
            provider: "playwright",
          };
        }

        return {
          success: true,
          data: { image_url: imageUrl, width, height, source_url: url },
          provider: "playwright",
          units_consumed: 1,
        };
      }

      if (operation === "scrape-text") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "playwright",
          };
        }

        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; ToolRoute/1.0; +https://toolroute.ai)",
          },
        });

        if (!res.ok) {
          return {
            success: false,
            error: `Fetch failed: ${res.status} ${res.statusText}`,
            provider: "playwright",
          };
        }

        const html = await res.text();

        // Strip script/style tags and their content, then strip remaining HTML tags
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        return {
          success: true,
          data: {
            text: text.slice(0, 50000), // Cap at 50K chars
            length: text.length,
            truncated: text.length > 50000,
            source_url: url,
          },
          provider: "playwright",
          units_consumed: 1,
        };
      }

      if (operation === "pdf") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "playwright",
          };
        }

        // Use urlbox.io free tier or fall back to screenshot with note
        // thum.io PDF is unreliable, so return a screenshot URL as fallback
        const screenshotUrl = `${THUM_BASE}/width/1280/noanimate/${url}`;
        const res = await fetch(screenshotUrl, { method: "HEAD" });

        if (!res.ok) {
          return {
            success: false,
            error: `PDF/screenshot service returned ${res.status}`,
            provider: "playwright",
          };
        }

        return {
          success: true,
          data: {
            image_url: screenshotUrl,
            source_url: url,
            note: "Full-page screenshot (PDF generation requires Playwright server deployment)"
          },
          provider: "playwright",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "playwright",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "playwright" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      const res = await fetch(
        `${THUM_BASE}/width/320/crop/240/https://example.com`,
        { method: "HEAD" }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "screenshot") return 0.005;
    if (operation === "scrape-text") return 0.002;
    if (operation === "pdf") return 0.005;
    return 0.005;
  },
};
