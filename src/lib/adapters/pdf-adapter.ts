import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const HTML2PDF_URL = "https://api.html2pdf.app/v1/generate";

function getApiKey(byokKey?: string): string | null {
  return byokKey || process.env.HTML2PDF_API_KEY || null;
}

export const pdfAdapter: ToolAdapter = {
  slug: "pdf",
  name: "PDF Generation",
  description:
    "Generate PDFs from HTML content or URLs via html2pdf.app API",
  operations: ["from-html", "from-url"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const apiKey = getApiKey(byokKey);

    try {
      if (operation === "from-html") {
        const html = input.html as string;
        if (!html) {
          return {
            success: false,
            error: "Missing required field: html",
            provider: "html2pdf",
          };
        }

        if (!apiKey) {
          return {
            success: false,
            error:
              "No API key configured. Set HTML2PDF_API_KEY or provide your own key via BYOK. " +
              "Get a free key at https://html2pdf.app",
            provider: "html2pdf",
          };
        }

        const filename = (input.filename as string) ?? "document.pdf";

        const params = new URLSearchParams({
          apiKey,
        });

        const res = await fetch(`${HTML2PDF_URL}?${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html,
            fileName: filename,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`html2pdf from-html failed: ${res.status} ${errText}`),
            provider: "html2pdf",
          };
        }

        // The API returns the PDF binary — we need to get the URL or base64
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/pdf")) {
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          return {
            success: true,
            data: {
              pdf_base64: base64,
              filename,
              size_bytes: buffer.byteLength,
              content_type: "application/pdf",
            },
            provider: "html2pdf",
            units_consumed: 1,
          };
        }

        // Some responses may include a URL
        const data = await res.json();
        return {
          success: true,
          data: {
            pdf_url: data.url ?? data.pdf_url,
            filename,
          },
          provider: "html2pdf",
          units_consumed: 1,
        };
      }

      if (operation === "from-url") {
        const url = input.url as string;
        if (!url) {
          return {
            success: false,
            error: "Missing required field: url",
            provider: "html2pdf",
          };
        }

        if (!apiKey) {
          return {
            success: false,
            error:
              "No API key configured. Set HTML2PDF_API_KEY or provide your own key via BYOK. " +
              "Get a free key at https://html2pdf.app",
            provider: "html2pdf",
          };
        }

        const filename = (input.filename as string) ?? "document.pdf";

        const params = new URLSearchParams({
          apiKey,
          url,
        });

        const res = await fetch(`${HTML2PDF_URL}?${params}`, {
          method: "GET",
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`html2pdf from-url failed: ${res.status} ${errText}`),
            provider: "html2pdf",
          };
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/pdf")) {
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          return {
            success: true,
            data: {
              pdf_base64: base64,
              filename,
              size_bytes: buffer.byteLength,
              content_type: "application/pdf",
            },
            provider: "html2pdf",
            units_consumed: 1,
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            pdf_url: data.url ?? data.pdf_url,
            filename,
          },
          provider: "html2pdf",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "html2pdf",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "html2pdf" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    try {
      // Lightweight check — just verify the API accepts our key
      const params = new URLSearchParams({ apiKey });
      const res = await fetch(`${HTML2PDF_URL}?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: "<p>health check</p>" }),
      });
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(): number {
    return 0.005;
  },
};
