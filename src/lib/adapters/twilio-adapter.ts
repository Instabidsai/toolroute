import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { redactCreds } from "../redact-creds";

function getCredentials(byokKey?: string): {
  accountSid: string;
  authToken: string;
} | null {
  if (byokKey && byokKey.includes(":")) {
    const [accountSid, authToken] = byokKey.split(":", 2);
    return { accountSid, authToken };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken) {
    return { accountSid, authToken };
  }

  return null;
}

function baseUrl(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
}

export const twilioAdapter: ToolAdapter = {
  slug: "twilio",
  name: "Twilio",
  description:
    "Twilio communications — send SMS, make voice calls, and list message history",
  operations: ["send-sms", "make-call", "list-messages"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    const creds = getCredentials(byokKey);
    if (!creds) {
      return {
        success: false,
        error:
          "No credentials configured. Provide BYOK as 'SID:TOKEN' or set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
        provider: "twilio",
      };
    }

    const { accountSid, authToken } = creds;
    const authHeader =
      "Basic " +
      Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    try {
      if (operation === "send-sms") {
        const to = input.to as string;
        const from = input.from as string;
        const body = input.body as string;

        if (!to || !from || !body) {
          return {
            success: false,
            error: "Missing required fields: to, from, body",
            provider: "twilio",
          };
        }

        const params = new URLSearchParams();
        params.append("To", to);
        params.append("From", from);
        params.append("Body", body);

        const res = await fetchWithTimeout(`${baseUrl(accountSid)}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twilio send-sms failed: ${res.status} ${errText}`),
            provider: "twilio",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twilio",
          units_consumed: 1,
        };
      }

      if (operation === "make-call") {
        const to = input.to as string;
        const from = input.from as string;
        const url = input.url as string;

        if (!to || !from || !url) {
          return {
            success: false,
            error: "Missing required fields: to, from, url (TwiML URL)",
            provider: "twilio",
          };
        }

        const params = new URLSearchParams();
        params.append("To", to);
        params.append("From", from);
        params.append("Url", url);

        const res = await fetchWithTimeout(`${baseUrl(accountSid)}/Calls.json`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          timeoutMs: 15_000,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twilio make-call failed: ${res.status} ${errText}`),
            provider: "twilio",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twilio",
          units_consumed: 1,
        };
      }

      if (operation === "list-messages") {
        const limit = (input.limit as number) ?? 20;

        const res = await fetchWithTimeout(
          `${baseUrl(accountSid)}/Messages.json?PageSize=${limit}`,
          {
            method: "GET",
            headers: { Authorization: authHeader },
            timeoutMs: 15_000,
          }
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            success: false,
            error: redactCreds(`Twilio list-messages failed: ${res.status} ${errText}`),
            provider: "twilio",
          };
        }

        const data = await res.json();
        return {
          success: true,
          data,
          provider: "twilio",
          units_consumed: 1,
        };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "twilio",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "twilio" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    const creds = getCredentials();
    if (!creds) {
      return { healthy: false, latency_ms: Date.now() - start };
    }

    const { accountSid, authToken } = creds;
    const authHeader =
      "Basic " +
      Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    try {
      const res = await fetchWithTimeout(
        `${baseUrl(accountSid)}.json`,
        {
          method: "GET",
          headers: { Authorization: authHeader },
          timeoutMs: 10_000,
        }
      );
      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "send-sms") return 0.01;
    if (operation === "make-call") return 0.02;
    if (operation === "list-messages") return 0.001;
    return 0.01;
  },
};
