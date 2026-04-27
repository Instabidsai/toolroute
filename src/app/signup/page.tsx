"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { getEmailDomain, isDisposableEmail } from "@/lib/disposable-domains";

type SignupResponse = {
  error?: string | { message?: string };
  message?: string;
  user_id?: string;
};

function getPayloadMessage(payload: SignupResponse) {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  return payload.error?.message ?? payload.message ?? "";
}

function normalizeSignupError(status: number, payload: SignupResponse) {
  const message = getPayloadMessage(payload).trim();
  const lowerMessage = message.toLowerCase();

  if (status === 409 || lowerMessage.includes("already")) {
    return "Email already registered. Sign in instead.";
  }

  if (lowerMessage.includes("weak") || lowerMessage.includes("password")) {
    return message || "Use a stronger password.";
  }

  if (status === 404) {
    return "Signup is not available yet. Try again shortly.";
  }

  return message || "Could not create the account. Try again.";
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailDomain = useMemo(() => getEmailDomain(email), [email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    setError(null);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (isDisposableEmail(normalizedEmail)) {
      setError(
        `${emailDomain} email addresses are not allowed for account creation.`
      );
      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (!acceptedTerms) {
      setError("Accept the terms to create an account.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          accepted_tos: true,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as SignupResponse;

      if (!response.ok) {
        setError(normalizeSignupError(response.status, payload));
        return;
      }

      window.location.assign("/dashboard?welcome=1");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] py-6">
      <div className="w-full max-w-md">
        <div className="border border-border rounded-lg bg-bg-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              Create a Tool<span className="text-accent">Route</span> account
            </h1>
            <p className="text-xs text-text-dim mt-1">
              Start with a test key. Add credits when you are ready.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-text-dim mb-2"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-surface py-3 pl-10 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
                  placeholder="agent@example.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-text-dim mb-2"
              >
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-surface py-3 pl-10 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
                  placeholder="At least 8 characters"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border bg-bg-surface p-3 text-xs text-text-dim">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
              />
              <span>
                I accept the{" "}
                <Link
                  href="/terms"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  terms
                </Link>{" "}
                and understand ToolRoute starts new accounts with $0 credits.
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="flex gap-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-xs text-red"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-green/25 bg-green/10 px-3 py-2 text-xs text-green">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Signup mints test keys only. Live keys require checkout.</span>
          </div>

          <div className="mt-6 grid gap-2 text-xs text-text-dim">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan" />
              <span>One dashboard for keys, credits, and usage.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan" />
              <span>No starter credit grant while rate limiting is under audit.</span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-xs text-text-dim hover:text-accent transition-colors"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
