import type { ToolAdapter, AdapterResult } from "../gateway-types";

const SCREENSHOTONE_URL = "https://api.screenshotone.com/take";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.SCREENSHOTONE_API_KEY || null;
}

export const screenshotAdapter: ToolAdapter = {
  slug: "screenshot",
  name: "Screenshot Capture",
  description:
    "High-quality website screenshots via ScreenshotOne API with thum.io fallback",
  operations: ["capture", "fullpage"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const url = input.url as string;
    if (!url) {
      return {
        success: false,
        error: "Missing required field: url",
        provider: "screenshotone",
      };
    }

    const width = (input.width as number) ?? 1280;
    const height = (input.height as number) ?? 720;
    const format = (input.format as string) ?? "png";

    const apiKey = getApiKey(byokKey);

    try {
      if (operation === "capture") {
        if (apiKey) {
          const params = new URLSearchParams({
            access_key: apiKey,
            url,
            viewport_width: String(width),
            viewport_height: String(height),
            format,
            full_page: "false",
          });

          const screenshotUrl = `${SCREENSHOTONE_URL}?${params}`;

          // Verify the URL is accessible
          const res = await fetch(screenshotUrl, { method: "HEAD" });
          if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            return {
              success: false,
              error: `ScreenshotOne capture failed: ${res.status} ${errText}`,
              provider: "screenshotone",
            };
          }

          return {
            success: true,
            data: {
              image_url: screenshotUrl,
              width,
              height,
              format,
              provider_used: "screenshotone",
            },
            provider: "screenshotone",
            units_consumed: 1,
          };
        }

        // Fallback to thum.io (free, no auth required)
        const thumbUrl = `https://image.thum.io/get/width/${width}/crop/${height}/${url}`;
        return {
          success: true,
          data: {
            image_url: thumbUrl,
            width,
            height,
            format: "png",
            provider_used: "thum.io",
            note: "Using free thum.io fallback. Set SCREENSHOTONE_API_KEY for higher quality.",
          },
          provider: "thum.io",
          units_consumed: 1,
        };
      }

      if (operation === "fullpage") {
        if (apiKey) {
          const params = new URLSearchParams({
            access_key: apiKey,
            url,
            viewport_width: String(width),
            format,
            full_page: "true",
          });

          const screenshotUrl = `${SCREENSHOTONE_URL}?${params}`;

          const res = await fetch(screenshotUrl, { method: "HEAD" });
          if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            return {
              success: false,
              error: `ScreenshotOne fullpage failed: ${res.status} ${errText}`,
              provider: "screenshotone",
            };
          }

          return {
            success: true,
            data: {
              image_url: screenshotUrl,
              width,
              format,
              full_page: true,
              provider_used: "screenshotone",
            },
            provider: "screenshotone",
            units_consumed: 1,
          };
        }

        // Fallback to thum.io full page
        const thumbUrl = `https://image.thum.io/get/width/${width}/noanimate/${url}`;
        return {
          success: true,
          data: {
            image_url: thumbUrl,
            width,
            full_page: true,
            provider_used: "thum.io",
            note: "Using free thum.io fallback. Set SCREENSHOTONE_API_KEY for higher quality.",
          },
          provider: "thum.io",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "screenshotone",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "screenshotone" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();

    try {
      // Check thum.io (always available, no key needed)
      const res = await fetch(
        "https://image.thum.io/get/width/100/crop/100/https://example.com",
        { method: "HEAD" }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.005;
  },
};
