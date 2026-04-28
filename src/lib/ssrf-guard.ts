// Lane 4.31 — SSRF guard for adapters that fetch user-supplied URLs.
// Blocks private IPv4 ranges, IPv6 loopback/link-local, file:/data: schemes,
// and non-http(s) protocols. Use BEFORE awaiting fetch(userUrl).

const BLOCKED_IPV4_RANGES: Array<[number, number]> = [
  // 10.0.0.0/8
  [0x0a000000, 0x0affffff],
  // 127.0.0.0/8 (loopback)
  [0x7f000000, 0x7fffffff],
  // 169.254.0.0/16 (link-local — AWS/GCP metadata service lives here)
  [0xa9fe0000, 0xa9feffff],
  // 172.16.0.0/12
  [0xac100000, 0xac1fffff],
  // 192.168.0.0/16
  [0xc0a80000, 0xc0a8ffff],
  // 0.0.0.0/8
  [0x00000000, 0x00ffffff],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n * 256) + o;
  }
  return n >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return BLOCKED_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isBlockedIpv6(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "::1" || lower === "[::1]") return true;
  if (lower === "::" || lower === "[::]") return true;
  // fc00::/7 unique local + fe80::/10 link-local
  if (/^\[?(fc|fd|fe[89ab])/.test(lower)) return true;
  // ::ffff:127.0.0.1 IPv4-mapped IPv6 loopback
  if (/^\[?::ffff:/.test(lower)) return true;
  return false;
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

export function assertSafePublicUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SSRFError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFError(`Unsupported URL scheme: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname)) {
    throw new SSRFError(`Blocked host: ${hostname}`);
  }

  // IPv4 literal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedIpv4(hostname)) {
      throw new SSRFError(`Blocked IP range: ${hostname}`);
    }
  }

  // IPv6 literal (with or without brackets in hostname)
  if (hostname.includes(":") || parsed.hostname.startsWith("[")) {
    if (isBlockedIpv6(hostname)) {
      throw new SSRFError(`Blocked IPv6: ${hostname}`);
    }
  }

  return parsed;
}
