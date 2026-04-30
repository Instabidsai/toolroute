const TOOLROUTE_BEARER_RE = /^Bearer tr_(live|test)_[A-Za-z0-9]+/;

export function hasToolRouteBearerToken(authHeader: string | null): boolean {
  return Boolean(authHeader && TOOLROUTE_BEARER_RE.test(authHeader));
}

export const TOOLROUTE_KEY_HEADER_HINT =
  "API key required. Set Authorization: Bearer tr_live_xxx or Bearer tr_test_xxx. Get a key at https://toolroute.ai/dashboard/keys";
