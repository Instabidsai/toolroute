import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";
import { fetchWithTimeout } from "../fetch-with-timeout";

const GDRIVE_BASE = "https://www.googleapis.com/drive/v3";
const GDRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export const driveAdapter: ToolAdapter = {
  slug: "drive",
  name: "Google Drive",
  description:
    "Google Drive file management — list, search, read, and upload files. BYOK-only (requires Google OAuth token).",
  operations: ["list-files", "search", "get-content", "upload-text"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    if (!byokKey) {
      return {
        success: false,
        error:
          "Google Drive requires a Google OAuth access token via BYOK. " +
          "No pooled key is available for this service.",
        provider: "google-drive",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${byokKey}`,
    };

    try {
      if (operation === "list-files") {
        const pageSize = (input.page_size as number) ?? 20;
        const params = new URLSearchParams({
          pageSize: String(pageSize),
          fields:
            "files(id,name,mimeType,size,modifiedTime,webViewLink),nextPageToken",
        });

        if (input.folder_id && input.folder_id !== "root") {
          params.append(
            "q",
            `'${input.folder_id as string}' in parents and trashed = false`
          );
        } else if (input.query) {
          params.append(
            "q",
            `${input.query as string} and trashed = false`
          );
        } else {
          params.append("q", "trashed = false");
        }

        const res = await fetchWithTimeout(`${GDRIVE_BASE}/files?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Google Drive list-files failed: ${res.status} ${errText}`),
            provider: "google-drive",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            files: data.files ?? [],
            next_page_token: data.nextPageToken ?? null,
          },
          provider: "google-drive",
          units_consumed: 1,
        };
      }

      if (operation === "search") {
        const query = input.query as string;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "google-drive",
          };
        }

        const pageSize = (input.page_size as number) ?? 20;
        const params = new URLSearchParams({
          pageSize: String(pageSize),
          q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
          fields:
            "files(id,name,mimeType,size,modifiedTime,webViewLink),nextPageToken",
        });

        const res = await fetchWithTimeout(`${GDRIVE_BASE}/files?${params}`, {
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Google Drive search failed: ${res.status} ${errText}`),
            provider: "google-drive",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            files: data.files ?? [],
            query,
            next_page_token: data.nextPageToken ?? null,
          },
          provider: "google-drive",
          units_consumed: 1,
        };
      }

      if (operation === "get-content") {
        const fileId = input.file_id as string;
        if (!fileId) {
          return {
            success: false,
            error: "Missing required field: file_id",
            provider: "google-drive",
          };
        }

        // First get file metadata to determine type
        const metaRes = await fetchWithTimeout(
          `${GDRIVE_BASE}/files/${fileId}?fields=id,name,mimeType,size`,
          { headers }
        );

        if (!metaRes.ok) {
          const errText = await metaRes.text().catch(() => metaRes.statusText);
          return {
            success: false,
            error: redactCreds(`Google Drive get metadata failed: ${metaRes.status} ${errText}`),
            provider: "google-drive",
          };
        }

        const meta = await metaRes.json();
        const mimeType = meta.mimeType as string;

        // Google Workspace files need export
        const isGoogleDoc = mimeType.startsWith(
          "application/vnd.google-apps."
        );

        let contentRes: Response;
        if (isGoogleDoc) {
          // Export Google Docs as plain text
          const exportMime =
            mimeType === "application/vnd.google-apps.spreadsheet"
              ? "text/csv"
              : "text/plain";
          contentRes = await fetchWithTimeout(
            `${GDRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
            { headers }
          );
        } else {
          contentRes = await fetchWithTimeout(
            `${GDRIVE_BASE}/files/${fileId}?alt=media`,
            { headers }
          );
        }

        if (!contentRes.ok) {
          const errText = await contentRes
            .text()
            .catch(() => contentRes.statusText);
          return {
            success: false,
            error: redactCreds(`Google Drive get-content failed: ${contentRes.status} ${errText}`),
            provider: "google-drive",
          };
        }

        const contentType =
          contentRes.headers.get("content-type") ?? "";
        let content: string;

        if (
          contentType.includes("text") ||
          contentType.includes("json") ||
          contentType.includes("csv")
        ) {
          content = await contentRes.text();
        } else {
          // Binary files — return base64
          const buffer = await contentRes.arrayBuffer();
          content = Buffer.from(buffer).toString("base64");
        }

        return {
          success: true,
          data: {
            file_id: fileId,
            name: meta.name,
            mime_type: mimeType,
            content,
            is_base64:
              !contentType.includes("text") &&
              !contentType.includes("json") &&
              !contentType.includes("csv"),
          },
          provider: "google-drive",
          units_consumed: 1,
        };
      }

      if (operation === "upload-text") {
        const name = input.name as string;
        if (!name) {
          return {
            success: false,
            error: "Missing required field: name",
            provider: "google-drive",
          };
        }

        const content = input.content as string;
        if (content === undefined || content === null) {
          return {
            success: false,
            error: "Missing required field: content",
            provider: "google-drive",
          };
        }

        const mimeType = (input.mime_type as string) ?? "text/plain";
        const folderId = (input.folder_id as string) ?? "root";

        // Use multipart upload
        const metadata = {
          name,
          mimeType,
          parents: [folderId],
        };

        const boundary = "toolroute_upload_boundary";
        const body = [
          `--${boundary}`,
          "Content-Type: application/json; charset=UTF-8",
          "",
          JSON.stringify(metadata),
          `--${boundary}`,
          `Content-Type: ${mimeType}`,
          "",
          content,
          `--${boundary}--`,
        ].join("\r\n");

        const res = await fetchWithTimeout(
          `${GDRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`,
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body,
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Google Drive upload-text failed: ${res.status} ${errText}`),
            provider: "google-drive",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            file_id: data.id,
            name: data.name,
            mime_type: data.mimeType,
            size: data.size,
            web_view_link: data.webViewLink,
          },
          provider: "google-drive",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "google-drive",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "google-drive" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    // BYOK-only — no pooled key to test with
    return { healthy: false, latency_ms: Date.now() - start };
  },

  estimateCost(): number {
    return 0.001;
  },
};
