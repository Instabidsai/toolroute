import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/gateway";
import { setSecureCookie } from "@/lib/cookie-security";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_auth_code", requestUrl.origin)
    );
  }

  const response = NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            setSecureCookie(response, name, value, options);
          });
        },
      },
    }
  );
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL("/login?error=auth_exchange_failed", requestUrl.origin)
    );
  }

  const admin = supabaseAdmin();
  const user = data.user;
  const email = user.email ?? "";
  const verifiedAt = new Date().toISOString();
  const { data: existing } = await admin
    .from("gateway_users")
    .select("metadata, email")
    .eq("id", user.id)
    .maybeSingle();

  const metadata = {
    ...(isRecord(existing?.metadata) ? existing.metadata : {}),
    email_verified: true,
    email_verified_at: verifiedAt,
  };

  // Live schema has no email_verified column; store verification state in metadata.
  if (existing) {
    const { error: updateErr } = await admin
      .from("gateway_users")
      .update({
        email: email || existing.email,
        metadata,
        updated_at: verifiedAt,
      })
      .eq("id", user.id);
    if (updateErr) {
      console.error("auth/callback: gateway_users update failed", updateErr.message, { userId: user.id });
      return NextResponse.redirect(
        new URL("/login?error=profile_sync_failed", requestUrl.origin)
      );
    }
  } else {
    const { error: insertErr } = await admin.from("gateway_users").insert({
      id: user.id,
      email,
      display_name: email ? email.split("@")[0] : "ToolRoute user",
      plan_slug: "free",
      credit_balance: 0,
      lifetime_credits: 0,
      lifetime_usage: 0,
      metadata,
    });
    if (insertErr) {
      console.error("auth/callback: gateway_users insert failed", insertErr.message, { userId: user.id });
      return NextResponse.redirect(
        new URL("/login?error=profile_create_failed", requestUrl.origin)
      );
    }
  }

  return response;
}
