import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { AUTHED_RESPONSE_HEADERS, supabaseAdmin } from "@/lib/gateway";
import { getEmailDomain, isDisposableEmail } from "@/lib/disposable-domains";
import { assertBodyUnder, BODY_LIMITS } from "@/lib/body-limit";
import { GatewayError } from "@/lib/gateway-types";

type SignupBody = {
  email?: unknown;
  password?: unknown;
  accepted_tos?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FROM_EMAIL = "ToolRoute <onboarding@resend.dev>";

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json(
    { error: { message, code } },
    { status, headers: AUTHED_RESPONSE_HEADERS }
  );
}

function generateSignupApiKey() {
  const raw = "tr_test_" + randomBytes(20).toString("hex");
  return {
    raw,
    hash: createHash("sha256").update(raw).digest("hex"),
    prefix: raw.slice(0, 12),
  };
}

// Hardcoded production origin matches checkout/setup-payment pattern.
// Trusting request.url here would let any host that reaches this endpoint
// (Vercel preview, attacker-pointed CNAME) generate magic-link verify URLs
// pointing to the request host — Supabase allowlist is the only thing
// stopping account-takeover via verify-link redirect. Defense-in-depth:
// don't trust request origin for OAuth/auth-callback URLs.
const VERIFY_ORIGIN = "https://toolroute.ai";

function getVerifyOrigin(_request: NextRequest) {
  return VERIFY_ORIGIN;
}

async function generateVerifyUrl(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
  redirectTo: string
) {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  if (error) {
    return redirectTo;
  }

  return data.properties?.action_link ?? redirectTo;
}

async function sendWelcomeEmail(email: string, verifyUrl: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: email,
      subject: "Welcome to ToolRoute",
      text: [
        "Welcome to ToolRoute.",
        "",
        "Verify your email to finish setting up your account:",
        verifyUrl,
        "",
        "New accounts start with $0 credits. Add credits from the dashboard when you are ready to use live tools.",
      ].join("\n"),
    }),
  });

  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    assertBodyUnder(request, BODY_LIMITS.signup);
  } catch (err) {
    if (err instanceof GatewayError) {
      return jsonError(err.message, err.code, err.status);
    }
    throw err;
  }

  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return jsonError("Invalid JSON body", "invalid_json", 400);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_PATTERN.test(email)) {
    return jsonError("Enter a valid email address", "invalid_email", 400);
  }

  if (isDisposableEmail(email)) {
    return jsonError(
      `${getEmailDomain(email)} email addresses are not allowed`,
      "disposable_email",
      400
    );
  }

  if (password.length < 8) {
    return jsonError(
      "Password must be at least 8 characters",
      "weak_password",
      400
    );
  }

  if (body.accepted_tos !== true) {
    return jsonError("Terms must be accepted", "tos_required", 400);
  }

  const sb = supabaseAdmin();
  const { data: authData, error: authError } =
    await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        signup_source: "toolroute_password",
      },
    });

  if (authError || !authData.user) {
    const message = authError?.message || "Failed to create user";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("already")) {
      return jsonError("Email already registered", "email_taken", 409);
    }

    if (lowerMessage.includes("password")) {
      return jsonError(message, "weak_password", 400);
    }

    return jsonError("Failed to create account", "auth_create_failed", 500);
  }

  const userId = authData.user.id;
  const acceptedTermsAt = new Date().toISOString();
  const { error: userInsertError } = await sb.from("gateway_users").insert({
    id: userId,
    email,
    display_name: email.split("@")[0],
    plan_slug: "free",
    credit_balance: 0,
    lifetime_credits: 0,
    lifetime_usage: 0,
    metadata: {
      accepted_tos_at: acceptedTermsAt,
      signup_source: "password",
    },
  });

  if (userInsertError) {
    return jsonError(
      "Failed to create account profile",
      "gateway_user_insert_failed",
      500
    );
  }

  const apiKey = generateSignupApiKey();
  const { error: keyInsertError } = await sb.from("api_keys").insert({
    user_id: userId,
    name: "Default Test Key",
    key_hash: apiKey.hash,
    key_prefix: apiKey.prefix,
    is_active: true,
    rate_limit_rpm: 10,
  });

  if (keyInsertError) {
    return jsonError(
      "Failed to create API key",
      "api_key_insert_failed",
      500
    );
  }

  const verifyUrl = await generateVerifyUrl(
    sb,
    email,
    `${getVerifyOrigin(request)}/auth/callback`
  );

  await sendWelcomeEmail(email, verifyUrl).catch(() => false);

  return NextResponse.json(
    {
      user_id: userId,
      api_key: apiKey.raw,
      key_prefix: apiKey.prefix,
    },
    { status: 201, headers: AUTHED_RESPONSE_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AUTHED_RESPONSE_HEADERS });
}
