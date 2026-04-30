import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

export const calendarAdapter: ToolAdapter = {
  slug: "calendar",
  name: "Google Calendar",
  description:
    "Google Calendar operations — list events, create events, check availability. BYOK-only (requires Google OAuth token).",
  operations: ["list-events", "create-event", "check-availability"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    if (!byokKey) {
      return {
        success: false,
        error:
          "Google Calendar requires a Google OAuth access token via BYOK. " +
          "No pooled key is available for this service.",
        provider: "google-calendar",
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${byokKey}`,
      "Content-Type": "application/json",
    };

    try {
      if (operation === "list-events") {
        const calendarId = encodeURIComponent(
          (input.calendar_id as string) ?? "primary"
        );
        const maxResults = (input.max_results as number) ?? 10;

        const params = new URLSearchParams({
          maxResults: String(maxResults),
          singleEvents: "true",
          orderBy: "startTime",
        });

        if (input.time_min) {
          params.append("timeMin", input.time_min as string);
        }
        if (input.time_max) {
          params.append("timeMax", input.time_max as string);
        }

        const res = await fetch(
          `${GCAL_BASE}/calendars/${calendarId}/events?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Google Calendar list-events failed: ${res.status} ${errText}`),
            provider: "google-calendar",
          };
        }

        const data = await res.json();
        const events = (data.items ?? []).map(
          (e: Record<string, unknown>) => ({
            id: e.id,
            summary: e.summary,
            description: e.description,
            start: e.start,
            end: e.end,
            status: e.status,
            attendees: e.attendees,
            htmlLink: e.htmlLink,
          })
        );

        return {
          success: true,
          data: { events, total: events.length },
          provider: "google-calendar",
          units_consumed: 1,
        };
      }

      if (operation === "create-event") {
        const summary = input.summary as string;
        if (!summary) {
          return {
            success: false,
            error: "Missing required field: summary",
            provider: "google-calendar",
          };
        }

        const start = input.start as string;
        const end = input.end as string;
        if (!start || !end) {
          return {
            success: false,
            error: "Missing required fields: start and end",
            provider: "google-calendar",
          };
        }

        const calendarId = encodeURIComponent(
          (input.calendar_id as string) ?? "primary"
        );

        const eventBody: Record<string, unknown> = {
          summary,
          start: { dateTime: start },
          end: { dateTime: end },
        };

        if (input.description) {
          eventBody.description = input.description as string;
        }

        if (input.attendees) {
          const attendeeEmails = input.attendees as string[];
          eventBody.attendees = attendeeEmails.map((email) => ({
            email,
          }));
        }

        const res = await fetch(
          `${GCAL_BASE}/calendars/${calendarId}/events`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(eventBody),
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Google Calendar create-event failed: ${res.status} ${errText}`),
            provider: "google-calendar",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data: {
            id: data.id,
            summary: data.summary,
            start: data.start,
            end: data.end,
            htmlLink: data.htmlLink,
            status: data.status,
          },
          provider: "google-calendar",
          units_consumed: 1,
        };
      }

      if (operation === "check-availability") {
        const calendarId = encodeURIComponent(
          (input.calendar_id as string) ?? "primary"
        );

        // Default to today if no time range given
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(now);
        dayEnd.setHours(23, 59, 59, 999);

        const timeMin =
          (input.time_min as string) ?? dayStart.toISOString();
        const timeMax =
          (input.time_max as string) ?? dayEnd.toISOString();

        const params = new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: "50",
          singleEvents: "true",
          orderBy: "startTime",
        });

        const res = await fetch(
          `${GCAL_BASE}/calendars/${calendarId}/events?${params}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Google Calendar check-availability failed: ${res.status} ${errText}`),
            provider: "google-calendar",
          };
        }

        const data = await res.json();
        const busySlots = (data.items ?? [])
          .filter(
            (e: Record<string, unknown>) => e.status !== "cancelled"
          )
          .map((e: Record<string, unknown>) => ({
            summary: e.summary,
            start: e.start,
            end: e.end,
          }));

        return {
          success: true,
          data: {
            time_range: { start: timeMin, end: timeMax },
            busy_slots: busySlots,
            busy_count: busySlots.length,
            note:
              busySlots.length === 0
                ? "Calendar is free for this entire time range"
                : `${busySlots.length} event(s) found in this time range`,
          },
          provider: "google-calendar",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "google-calendar",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        provider: "google-calendar",
      };
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
