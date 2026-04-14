"use client";

import { useState, useEffect, useCallback } from "react";
import {
  KeyRound,
  AlertTriangle,
  Check,
  X,
  Mic,
  Globe,
  Brain,
  Mail,
  Phone,
  Code,
  CreditCard,
  Calendar,
  HardDrive,
  Database,
  PhoneCall,
  Film,
  Megaphone,
  Users,
  Package,
  Search,
  Image,
  Languages,
  Headphones,
  Repeat,
  Video,
  Eraser,
  FileSearch,
  Activity,
  Layers,
  Info,
  Shield,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LucideIcon } from "lucide-react";

/* ── Provider registry ────────────────────────────────────── */

interface Provider {
  slug: string;
  name: string;
  type: "pool" | "byok" | "free";
  category: string;
}

const PROVIDERS: Provider[] = [
  { slug: "elevenlabs", name: "ElevenLabs", type: "pool", category: "Voice" },
  { slug: "firecrawl", name: "Firecrawl", type: "pool", category: "Scraping" },
  { slug: "openai", name: "OpenAI", type: "pool", category: "AI" },
  { slug: "claude", name: "Claude (Anthropic)", type: "pool", category: "AI" },
  { slug: "sendgrid", name: "SendGrid", type: "pool", category: "Email" },
  { slug: "resend", name: "Resend", type: "pool", category: "Email" },
  { slug: "twilio", name: "Twilio", type: "byok", category: "SMS/Voice" },
  { slug: "github", name: "GitHub", type: "byok", category: "Code" },
  { slug: "stripe", name: "Stripe", type: "byok", category: "Payments" },
  { slug: "calendar", name: "Google Calendar", type: "byok", category: "Productivity" },
  { slug: "drive", name: "Google Drive", type: "byok", category: "Productivity" },
  { slug: "supabase", name: "Supabase", type: "byok", category: "Database" },
  { slug: "vapi", name: "Vapi", type: "byok", category: "Voice AI" },
  { slug: "creatify", name: "Creatify", type: "pool", category: "Ads" },
  { slug: "apollo", name: "Apollo.io", type: "pool", category: "Sales" },
  { slug: "shippo", name: "Shippo", type: "pool", category: "Shipping" },
  { slug: "search", name: "Brave Search", type: "pool", category: "Search" },
  { slug: "image", name: "fal.ai (Image Gen)", type: "pool", category: "AI" },
  { slug: "translate", name: "DeepL", type: "pool", category: "Translation" },
  { slug: "whisper", name: "OpenAI Whisper", type: "pool", category: "AI" },
  { slug: "deepgram", name: "Deepgram", type: "pool", category: "AI" },
  { slug: "replicate", name: "Replicate", type: "pool", category: "AI" },
  { slug: "heygen", name: "HeyGen", type: "pool", category: "Video" },
  { slug: "removebg", name: "Remove.bg", type: "pool", category: "Image" },
  { slug: "outscraper", name: "Outscraper", type: "pool", category: "Scraping" },
  { slug: "sentry", name: "Sentry", type: "byok", category: "Monitoring" },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Voice: Mic,
  Scraping: FileSearch,
  AI: Brain,
  Email: Mail,
  "SMS/Voice": Phone,
  Code: Code,
  Payments: CreditCard,
  Productivity: Calendar,
  Database: Database,
  "Voice AI": PhoneCall,
  Ads: Megaphone,
  Sales: Users,
  Shipping: Package,
  Search: Search,
  Image: Image,
  Translation: Languages,
  Video: Video,
  Monitoring: Activity,
};

/* ── Types ────────────────────────────────────────────────── */

interface ByokRecord {
  id: string;
  tool_slug: string;
  is_active: boolean;
  prefer_own_key: boolean;
  created_at: string;
  updated_at: string;
}

/* ── Component ────────────────────────────────────────────── */

export default function ProvidersPage() {
  const [byokKeys, setByokKeys] = useState<ByokRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Inline form state
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Category filter
  const [filterCategory, setFilterCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(PROVIDERS.map((p) => p.category)))];

  const fetchByokKeys = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/byok", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to fetch BYOK keys");
      setByokKeys(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load BYOK keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchByokKeys();
  }, [fetchByokKeys]);

  // Clear success after 4s
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  function getByokRecord(slug: string): ByokRecord | undefined {
    return byokKeys.find((k) => k.tool_slug === slug && k.is_active);
  }

  async function handleSave(slug: string) {
    if (!apiKeyInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/byok", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool_slug: slug, api_key: apiKeyInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save key");

      setEditingSlug(null);
      setApiKeyInput("");
      setSuccess(`${PROVIDERS.find((p) => p.slug === slug)?.name ?? slug} key saved successfully.`);
      await fetchByokKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(slug: string) {
    setRemoving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/byok", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool_slug: slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to remove key");

      setRemoveTarget(null);
      setSuccess(`${PROVIDERS.find((p) => p.slug === slug)?.name ?? slug} key removed.`);
      await fetchByokKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setRemoving(false);
    }
  }

  const filteredProviders =
    filterCategory === "All"
      ? PROVIDERS
      : PROVIDERS.filter((p) => p.category === filterCategory);

  /* ── Render ─────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-bg-card rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 bg-bg-card border border-border rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-text-dim" />
          Provider Keys (BYOK)
        </h1>
        <p className="text-xs text-text-dim mt-1 max-w-xl">
          Bring your own API keys. When set, your key is used instead of
          ToolRoute&apos;s shared pool — with no markup.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="border border-red/20 rounded-lg bg-red/5 px-4 py-3 text-xs text-red flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red/60 hover:text-red transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {success && (
        <div className="border border-green/30 rounded-lg bg-green/5 px-4 py-3 text-xs text-green flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" />
          {success}
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              filterCategory === cat
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-bg-card text-text-dim border border-border hover:text-text hover:border-border-bright"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Provider list */}
      <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left p-3 font-medium">Provider</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Type</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProviders.map((provider) => {
                const record = getByokRecord(provider.slug);
                const isEditing = editingSlug === provider.slug;
                const isRemoving = removeTarget === provider.slug;
                const Icon = CATEGORY_ICONS[provider.category] ?? Layers;

                return (
                  <tr
                    key={provider.slug}
                    className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors"
                  >
                    {/* Provider name */}
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="font-medium">{provider.name}</span>
                      </span>
                    </td>

                    {/* Category */}
                    <td className="p-3 text-text-dim hidden sm:table-cell">
                      {provider.category}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {record ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green/10 text-green border border-green/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-surface text-text-muted border border-border">
                          Not set
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="p-3 hidden md:table-cell">
                      {provider.type === "pool" ? (
                        <span className="text-text-dim">Pool available</span>
                      ) : provider.type === "byok" ? (
                        <span className="text-amber">BYOK only</span>
                      ) : (
                        <span className="text-green">Free</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      {isRemoving ? (
                        <span className="flex items-center gap-1.5 justify-end">
                          <span className="text-[10px] text-amber">Remove?</span>
                          <button
                            onClick={() => handleRemove(provider.slug)}
                            disabled={removing}
                            className="text-red hover:text-red/80 transition-colors text-[10px] font-semibold"
                          >
                            {removing ? "..." : "Yes"}
                          </button>
                          <button
                            onClick={() => setRemoveTarget(null)}
                            className="text-text-dim hover:text-text transition-colors text-[10px]"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 justify-end">
                          {record ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingSlug(provider.slug);
                                  setApiKeyInput("");
                                }}
                                className="px-2 py-1 rounded text-[10px] text-text-dim hover:text-accent hover:bg-accent/10 transition-colors"
                              >
                                Update
                              </button>
                              <button
                                onClick={() => setRemoveTarget(provider.slug)}
                                className="px-2 py-1 rounded text-[10px] text-text-dim hover:text-red hover:bg-red/10 transition-colors"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingSlug(provider.slug);
                                setApiKeyInput("");
                              }}
                              className="px-2 py-1 rounded text-[10px] bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                            >
                              Add Key
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Add / Update form */}
      {editingSlug && (
        <div className="border border-accent/30 rounded-lg bg-bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-accent" />
              {getByokRecord(editingSlug) ? "Update" : "Add"} Key —{" "}
              {PROVIDERS.find((p) => p.slug === editingSlug)?.name ?? editingSlug}
            </h3>
            <button
              onClick={() => {
                setEditingSlug(null);
                setApiKeyInput("");
              }}
              className="text-text-muted hover:text-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste your API key here"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-text-muted mt-1">
                Your key is stored encrypted and never displayed after saving.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(editingSlug)}
                disabled={saving || !apiKeyInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Key"}
              </button>
              <button
                onClick={() => {
                  setEditingSlug(null);
                  setApiKeyInput("");
                }}
                className="px-3 py-1.5 rounded text-xs text-text-dim hover:text-text hover:bg-bg-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info sections */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-border rounded-lg bg-bg-card p-4">
          <h3 className="text-xs font-semibold flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5 text-accent" />
            Why BYOK?
          </h3>
          <ul className="text-[10px] text-text-dim space-y-1.5">
            <li className="flex items-start gap-1.5">
              <Shield className="w-3 h-3 text-green mt-0.5 shrink-0" />
              <span>Direct access without markup — your data stays between you and the provider.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <Zap className="w-3 h-3 text-amber mt-0.5 shrink-0" />
              <span>Your own rate limits and quotas — no sharing with other ToolRoute users.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CreditCard className="w-3 h-3 text-accent mt-0.5 shrink-0" />
              <span>Pay providers directly at their rates. ToolRoute only charges the platform fee.</span>
            </li>
          </ul>
        </div>

        <div className="border border-border rounded-lg bg-bg-card p-4">
          <h3 className="text-xs font-semibold flex items-center gap-2 mb-2">
            <Repeat className="w-3.5 h-3.5 text-accent" />
            How it works
          </h3>
          <ul className="text-[10px] text-text-dim space-y-1.5">
            <li className="flex items-start gap-1.5">
              <span className="text-accent font-bold shrink-0">1.</span>
              <span>Add your API key for any supported provider above.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-accent font-bold shrink-0">2.</span>
              <span>When you call a tool, ToolRoute uses YOUR key instead of the shared pool.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-accent font-bold shrink-0">3.</span>
              <span>You&apos;re billed only ToolRoute&apos;s platform fee ($0.001/call) instead of the tool&apos;s per-unit cost.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-accent font-bold shrink-0">4.</span>
              <span>&quot;Pool available&quot; tools work without BYOK. &quot;BYOK only&quot; tools require your own key.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
