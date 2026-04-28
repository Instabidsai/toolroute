import "server-only";
import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Validates an admin request by comparing the x-admin-secret header against
 * TOOLROUTE_ADMIN_SECRET via crypto.timingSafeEqual.
 *
 * Fail-closed if either the env var or the header is missing, and on length
 * mismatch (timingSafeEqual throws on differing lengths).
 *
 * Use in any route under src/app/api/admin/* before reading request body or
 * touching supabaseAdmin().
 */
export function validateAdmin(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  const expected = process.env.TOOLROUTE_ADMIN_SECRET;
  if (!expected || !secret) return false;
  if (secret.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
}
