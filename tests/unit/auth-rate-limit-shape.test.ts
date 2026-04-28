import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SIGNUP_ROUTE = join(
  process.cwd(),
  "src",
  "app",
  "api",
  "v1",
  "signup",
  "route.ts"
);
const API_V1_ROOT = join(process.cwd(), "src", "app", "api", "v1");

function listAllRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...listAllRoutes(p));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(p);
    }
  }
  return out;
}

// Lane 4.27 — auth/signup endpoint rate-limit drift prevention.
//
// `/api/v1/signup` has no application-level IP rate limit today.
// The route's defense lies in input-validation gates + Supabase
// platform throttling + Vercel edge DDoS protection. This test
// pins the in-source gates so any PR that quietly removes one
// fails master.

describe("Lane 4.27 — auth/signup rate-limit shape (drift prevention)", () => {
  const signupSrc = readFileSync(SIGNUP_ROUTE, "utf8");

  it("signup route validates email shape with EMAIL_PATTERN regex", () => {
    expect(
      /EMAIL_PATTERN\s*=\s*\/[^/]+\//.test(signupSrc),
      "EMAIL_PATTERN regex constant missing — email shape validation removed"
    ).toBe(true);
    expect(
      /EMAIL_PATTERN\.test\(\s*email\s*\)/.test(signupSrc),
      "EMAIL_PATTERN.test(email) call missing — email validation gate removed"
    ).toBe(true);
  });

  it("signup route enforces disposable-email blocklist", () => {
    expect(
      /isDisposableEmail\s*\(\s*email\s*\)/.test(signupSrc),
      "isDisposableEmail(email) call missing — disposable email gate removed"
    ).toBe(true);
  });

  it("signup route enforces password length >= 8", () => {
    // Match `password.length < 8` or equivalent. Anything looser
    // (e.g. < 6) trips this test and forces an explicit decision.
    expect(
      /password\.length\s*<\s*8\b/.test(signupSrc),
      "password.length < 8 check missing or weakened — password gate removed"
    ).toBe(true);
  });

  it("signup route requires accepted_tos === true", () => {
    expect(
      /body\.accepted_tos\s*!==\s*true/.test(signupSrc),
      "accepted_tos !== true check missing — TOS gate removed"
    ).toBe(true);
  });

  it("Resend send happens AFTER auth.admin.createUser succeeds (no spam-to-arbitrary-address)", () => {
    // Find the CALL site (`await sendWelcomeEmail(...)`), not the
    // function declaration (`async function sendWelcomeEmail(...)`).
    const createUserCallMatch = signupSrc.match(/await\s+sb\.auth\.admin\.createUser\s*\(/);
    const sendCallMatch = signupSrc.match(/await\s+sendWelcomeEmail\s*\(/);
    expect(
      createUserCallMatch,
      "await sb.auth.admin.createUser(...) call site missing"
    ).not.toBeNull();
    expect(
      sendCallMatch,
      "await sendWelcomeEmail(...) call site missing"
    ).not.toBeNull();
    const createUserIdx = createUserCallMatch!.index!;
    const sendIdx = sendCallMatch!.index!;
    expect(
      sendIdx,
      "sendWelcomeEmail() call site must appear AFTER sb.auth.admin.createUser() — moving it before would allow attackers to spam emails to arbitrary addresses"
    ).toBeGreaterThan(createUserIdx);
  });

  it("no /api/v1/login or password-reset route exists (any new auth route requires audit update)", () => {
    const allRoutes = listAllRoutes(API_V1_ROOT);
    const authClassRoutes = allRoutes.filter((p) => {
      const lower = p.toLowerCase();
      return (
        lower.includes("\\login\\") ||
        lower.includes("/login/") ||
        lower.includes("password-reset") ||
        lower.includes("password_reset") ||
        lower.includes("\\reset\\") ||
        lower.includes("/reset/") ||
        lower.includes("\\otp\\") ||
        lower.includes("/otp/")
      );
    });
    expect(
      authClassRoutes,
      `New auth-class route detected. Update Lane 4.27 audit to cover rate-limit posture before merging:\n${authClassRoutes.join("\n")}`
    ).toEqual([]);
  });

  it("no signInWithPassword/resetPasswordForEmail/signInWithOtp calls in src/app/api", () => {
    const allRoutes = listAllRoutes(join(process.cwd(), "src", "app", "api"));
    const violations: string[] = [];
    const pat = /signInWithPassword|resetPasswordForEmail|signInWithOtp/;
    for (const r of allRoutes) {
      const src = readFileSync(r, "utf8");
      if (pat.test(src)) {
        violations.push(r);
      }
    }
    expect(
      violations,
      `Unauthenticated auth-mutation call found in src/app/api/. Lane 4.27 audit assumes only /api/v1/signup is brute-forceable. Update audit + drift test before merging:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
