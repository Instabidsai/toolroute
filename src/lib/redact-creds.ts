// Redact credential-shaped substrings from text destined for the
// `gateway_usage_log.error_message` column (or any persisted error log).
//
// Sized for the Lane 4.17 tail-risk class: a 3rd-party provider that echoes
// the Authorization header (or any fragment of an API key) into its 4xx/5xx
// response body would otherwise leak the key into our ops logs. See
// `.agent/lane-4.17-error-message-leak-audit.md` for the audit trail.
//
// Patterns covered (defense-in-depth — order matters: longest first):
//   - Bearer/Token/Key auth header echoes: "Bearer xyz...", "Token xyz...", "Key xyz..."
//   - ToolRoute keys: tr_live_*, tr_test_*
//   - OpenAI / Anthropic style: sk-...
//   - xAI / Groq / Stripe-restricted style: xai-..., gsk_..., rk_..., sk-ant-...
//
// Plus a 1000-char belt-and-suspenders truncation. Any single error message
// longer than that is almost certainly upstream HTML or stack-trace dump,
// which is its own data hygiene problem.

const REDACTED = "[REDACTED]";
const MAX_LEN = 1000;

const PATTERNS: RegExp[] = [
  // Auth header echoes — match scheme + token. Allow common token chars.
  /(?:Bearer|Token)\s+[A-Za-z0-9_\-\.=+/]{8,}/gi,
  /(?:DeepL-Auth-Key|Api-Key|X-Api-Key|Authorization:\s*Key)\s+[A-Za-z0-9_\-\.=+/]{8,}/gi,
  // Provider key prefixes (most specific first to avoid double-redact issues)
  /sk-ant-[A-Za-z0-9_\-]{20,}/g,
  /sk-proj-[A-Za-z0-9_\-]{20,}/g,
  /sk-[A-Za-z0-9_\-]{20,}/g,
  /xai-[A-Za-z0-9_\-]{20,}/g,
  /gsk_[A-Za-z0-9_\-]{20,}/g,
  /rk_(?:live|test)_[A-Za-z0-9_\-]{8,}/g,
  // ToolRoute's own customer keys
  /tr_(?:live|test)_[A-Za-z0-9_\-]{16,}/g,
];

export function redactCreds(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  let out = String(input);
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN) + "...[truncated]";
  return out;
}
