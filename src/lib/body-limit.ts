import { GatewayError } from "./gateway-types";

export const BODY_LIMITS = {
  execute: 256 * 1024,
  mcp: 256 * 1024,
  a2a: 256 * 1024,
  byok: 16 * 1024,
  keys: 4 * 1024,
  signup: 8 * 1024,
  checkout: 4 * 1024,
  settings: 4 * 1024,
  admin_providers: 16 * 1024,
  registry: 8 * 1024,
  check: 4 * 1024,
  stripe_webhook: 64 * 1024,
} as const;

export function assertBodyUnder(request: Request, maxBytes: number): void {
  const cl = request.headers.get("content-length");
  if (cl === null) return;
  const len = Number.parseInt(cl, 10);
  if (!Number.isFinite(len)) return;
  if (len > maxBytes) {
    throw new GatewayError(
      `Request body exceeds ${maxBytes} bytes (got ${len})`,
      413,
      "body_too_large"
    );
  }
}
