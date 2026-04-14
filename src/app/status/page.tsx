import type { Metadata } from "next";
import { Activity, CheckCircle, Circle, Info } from "lucide-react";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "System Status — ToolRoute",
  description:
    "Live system status for all 40 ToolRoute adapters. Check adapter health, availability, and configuration.",
};

/* ---------- Adapter registry ---------- */

type AdapterStatus = "available" | "pool_ready" | "needs_key";

interface AdapterInfo {
  slug: string;
  name: string;
  category: string;
  keyType: "free" | "pool" | "byok";
  status: AdapterStatus;
}

const ADAPTERS: AdapterInfo[] = [
  // Free — no key needed
  { slug: "toolroute", name: "ToolRoute", category: "Meta", keyType: "free", status: "available" },
  { slug: "context7", name: "Context7", category: "AI & LLM", keyType: "free", status: "available" },
  { slug: "auto", name: "Auto Router", category: "Meta", keyType: "free", status: "available" },
  { slug: "playwright", name: "Playwright", category: "Code & DevOps", keyType: "free", status: "available" },
  { slug: "pexels", name: "Pexels", category: "Image & Media", keyType: "free", status: "available" },
  { slug: "unsplash", name: "Unsplash", category: "Image & Media", keyType: "free", status: "available" },
  { slug: "github", name: "GitHub", category: "Code & DevOps", keyType: "free", status: "available" },

  // Pool ready — master keys available
  { slug: "claude", name: "Claude", category: "AI & LLM", keyType: "pool", status: "pool_ready" },
  { slug: "openai", name: "OpenAI", category: "AI & LLM", keyType: "pool", status: "pool_ready" },
  { slug: "elevenlabs", name: "ElevenLabs", category: "Voice & Audio", keyType: "pool", status: "pool_ready" },
  { slug: "firecrawl", name: "Firecrawl", category: "Search & Web", keyType: "pool", status: "pool_ready" },
  { slug: "sendgrid", name: "SendGrid", category: "Email", keyType: "pool", status: "pool_ready" },
  { slug: "resend", name: "Resend", category: "Email", keyType: "pool", status: "pool_ready" },
  { slug: "supabase", name: "Supabase", category: "Data & Analytics", keyType: "pool", status: "pool_ready" },
  { slug: "stripe", name: "Stripe", category: "Business", keyType: "pool", status: "pool_ready" },
  { slug: "twilio", name: "Twilio", category: "SMS", keyType: "pool", status: "pool_ready" },
  { slug: "deepl", name: "DeepL", category: "Content", keyType: "pool", status: "pool_ready" },
  { slug: "replicate", name: "Replicate", category: "AI & LLM", keyType: "pool", status: "pool_ready" },
  { slug: "deepgram", name: "Deepgram", category: "Voice & Audio", keyType: "pool", status: "pool_ready" },
  { slug: "postiz", name: "Postiz", category: "Social & Outreach", keyType: "pool", status: "pool_ready" },

  // BYOK — user brings own key
  { slug: "whisper", name: "Whisper", category: "Voice & Audio", keyType: "byok", status: "needs_key" },
  { slug: "search", name: "Web Search", category: "Search & Web", keyType: "byok", status: "needs_key" },
  { slug: "image-gen", name: "Image Gen", category: "Image & Media", keyType: "byok", status: "needs_key" },
  { slug: "screenshot", name: "Screenshot", category: "Code & DevOps", keyType: "byok", status: "needs_key" },
  { slug: "pdf", name: "PDF Tools", category: "Content", keyType: "byok", status: "needs_key" },
  { slug: "calendar", name: "Calendar", category: "Productivity", keyType: "byok", status: "needs_key" },
  { slug: "drive", name: "Drive", category: "Productivity", keyType: "byok", status: "needs_key" },
  { slug: "removebg", name: "Remove.bg", category: "Image & Media", keyType: "byok", status: "needs_key" },
  { slug: "vapi", name: "Vapi", category: "Voice & Audio", keyType: "byok", status: "needs_key" },
  { slug: "creatify", name: "Creatify", category: "Video", keyType: "byok", status: "needs_key" },
  { slug: "apollo", name: "Apollo", category: "Social & Outreach", keyType: "byok", status: "needs_key" },
  { slug: "shippo", name: "Shippo", category: "Business", keyType: "byok", status: "needs_key" },
  { slug: "sentry", name: "Sentry", category: "Code & DevOps", keyType: "byok", status: "needs_key" },
  { slug: "outscraper", name: "Outscraper", category: "Data & Analytics", keyType: "byok", status: "needs_key" },
  { slug: "textbelt", name: "Textbelt", category: "SMS", keyType: "byok", status: "needs_key" },
  { slug: "heygen", name: "HeyGen", category: "Video", keyType: "byok", status: "needs_key" },
  { slug: "mux", name: "Mux", category: "Video", keyType: "byok", status: "needs_key" },
  { slug: "dataforseo", name: "DataForSEO", category: "Data & Analytics", keyType: "byok", status: "needs_key" },
  { slug: "creatomate", name: "Creatomate", category: "Video", keyType: "byok", status: "needs_key" },
  { slug: "shotstack", name: "Shotstack", category: "Video", keyType: "byok", status: "needs_key" },
];

/* ---------- Helpers ---------- */

function statusDot(status: AdapterStatus) {
  switch (status) {
    case "available":
      return <span className="w-2.5 h-2.5 rounded-full bg-green inline-block" title="Available — no key needed" />;
    case "pool_ready":
      return <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" title="Pool ready — master key configured" />;
    case "needs_key":
      return <span className="w-2.5 h-2.5 rounded-full bg-text-muted inline-block" title="Needs API key — BYOK or pool key required" />;
  }
}

function keyTypeBadge(keyType: "free" | "pool" | "byok") {
  switch (keyType) {
    case "free":
      return (
        <span className="text-[10px] uppercase tracking-wider font-medium text-green bg-green/10 border border-green/20 px-1.5 py-0.5 rounded">
          Free
        </span>
      );
    case "pool":
      return (
        <span className="text-[10px] uppercase tracking-wider font-medium text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">
          Pool
        </span>
      );
    case "byok":
      return (
        <span className="text-[10px] uppercase tracking-wider font-medium text-text-muted bg-bg-surface border border-border px-1.5 py-0.5 rounded">
          BYOK
        </span>
      );
  }
}

/* ---------- Page ---------- */

export default function StatusPage() {
  const totalAdapters = ADAPTERS.length;
  const available = ADAPTERS.filter((a) => a.status === "available").length;
  const poolReady = ADAPTERS.filter((a) => a.status === "pool_ready").length;
  const needsKey = ADAPTERS.filter((a) => a.status === "needs_key").length;

  const overallHealthy = available + poolReady > needsKey;
  const now = new Date().toISOString();

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <section className="pt-12 text-center">
        <div className="inline-flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-accent" />
          <h1 className="text-3xl sm:text-4xl font-bold">System Status</h1>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          {overallHealthy ? (
            <>
              <CheckCircle className="w-5 h-5 text-green" />
              <span className="text-green font-semibold text-sm">All Systems Operational</span>
            </>
          ) : (
            <>
              <Circle className="w-5 h-5 text-amber" />
              <span className="text-amber font-semibold text-sm">Partial Availability</span>
            </>
          )}
        </div>
        <p className="text-xs text-text-muted">
          Last checked: {now.replace("T", " ").slice(0, 19)} UTC
        </p>
      </section>

      {/* Stats bar */}
      <section>
        <div className="border border-border rounded-lg bg-bg-card p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-text">{totalAdapters}</p>
              <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Total Adapters</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green">{available}</p>
              <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Free / Available</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-accent">{poolReady}</p>
              <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Pool Ready</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-text-muted">{needsKey}</p>
              <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">BYOK Only</p>
            </div>
          </div>
        </div>
      </section>

      {/* Legend */}
      <section className="flex flex-wrap items-center justify-center gap-6">
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <span className="w-2.5 h-2.5 rounded-full bg-green inline-block" />
          Available — no key needed
        </div>
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
          Pool ready — master key configured
        </div>
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <span className="w-2.5 h-2.5 rounded-full bg-text-muted inline-block" />
          BYOK required
        </div>
      </section>

      {/* Adapter grid */}
      <section>
        <h2 className="text-xl font-bold mb-6">Adapter Status</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ADAPTERS.map((adapter) => (
            <div
              key={adapter.slug}
              className="border border-border rounded-lg p-4 bg-bg-card hover:bg-bg-card-hover transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusDot(adapter.status)}
                  <h3 className="font-semibold text-sm">{adapter.name}</h3>
                </div>
                {keyTypeBadge(adapter.keyType)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">
                  {adapter.category}
                </span>
                <code className="text-[10px] text-text-dim font-mono">{adapter.slug}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Info footer */}
      <section className="border border-border rounded-lg bg-bg-card p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-text-dim">
            <p>
              <strong className="text-text">Pool</strong> adapters use ToolRoute-managed API keys.
              Requests are billed through your ToolRoute credits at a zero-markup pass-through rate.
            </p>
            <p>
              <strong className="text-text">BYOK</strong> (Bring Your Own Key) adapters require you to
              configure your own API key via the dashboard. ToolRoute handles routing and billing but
              uses your key for the upstream call.
            </p>
            <p>
              <strong className="text-text">Free</strong> adapters require no API key and have no
              per-call cost beyond your plan rate limits.
            </p>
            <p className="text-xs text-text-muted pt-2">
              This page auto-refreshes every 30 seconds. Adapter availability reflects key
              configuration status, not real-time upstream provider health.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
