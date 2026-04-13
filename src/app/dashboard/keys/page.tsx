"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Shield,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  allowed_tools: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return formatDate(iso);
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-accent transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-green" />
          {label && <span className="text-green">Copied</span>}
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTools, setCreateTools] = useState("");
  const [creating, setCreating] = useState(false);

  // Newly created key (shown once)
  const [newKey, setNewKey] = useState<string | null>(null);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/keys", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to fetch keys");
      setKeys(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const body: Record<string, unknown> = {
        name: createName || "Default Key",
      };
      if (createTools.trim()) {
        body.allowed_tools = createTools
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create key");

      setNewKey(json.key);
      setShowCreate(false);
      setCreateName("");
      setCreateTools("");
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setRevoking(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/keys", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key_id: keyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to revoke key");

      setRevokeTarget(null);
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setRevoking(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-bg-card rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Key className="w-5 h-5 text-text-dim" />
            API Keys
          </h1>
          <p className="text-xs text-text-dim mt-1">
            Manage your gateway API keys
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setNewKey(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Key
        </button>
      </div>

      {error && (
        <div className="border border-red/20 rounded-lg bg-red/5 px-4 py-3 text-xs text-red flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* New key reveal */}
      {newKey && (
        <div className="border border-green/30 rounded-lg bg-green/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-green" />
            <span className="text-xs font-semibold text-green">
              API Key Created
            </span>
          </div>
          <p className="text-[10px] text-amber mb-3">
            Copy this key now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2 bg-bg rounded-md border border-border p-2">
            <code className="text-xs text-text flex-1 break-all select-all">
              {newKey}
            </code>
            <CopyButton text={newKey} label="Copy" />
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-[10px] text-text-dim hover:text-text transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border border-border rounded-lg bg-bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold">Create New API Key</h3>
            <button
              onClick={() => setShowCreate(false)}
              className="text-text-muted hover:text-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                Key Name
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., Production, Development"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                Allowed Tools{" "}
                <span className="text-text-muted normal-case">(optional, comma-separated)</span>
              </label>
              <input
                type="text"
                value={createTools}
                onChange={(e) => setCreateTools(e.target.value)}
                placeholder="e.g., toolroute/search_tools, toolroute/check_before_build"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Key"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded text-xs text-text-dim hover:text-text hover:bg-bg-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 && !showCreate ? (
        <div className="border border-border rounded-lg bg-bg-card p-8 text-center">
          <Key className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-dim mb-1">No API keys yet</p>
          <p className="text-[10px] text-text-muted mb-4">
            Create your first key to start using the ToolRoute gateway.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-accent text-white text-xs hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create API Key
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted text-[10px] uppercase tracking-wider">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Prefix</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">
                    Created
                  </th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">
                    Last Used
                  </th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr
                    key={key.id}
                    className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors"
                  >
                    <td className="p-3 font-medium">{key.name}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5">
                        <code className="text-text-dim">
                          {key.key_prefix}...
                        </code>
                        <CopyButton text={key.key_prefix} />
                      </span>
                    </td>
                    <td className="p-3 text-text-dim hidden md:table-cell">
                      {formatDate(key.created_at)}
                    </td>
                    <td className="p-3 text-text-dim hidden sm:table-cell">
                      {formatTime(key.last_used_at)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          key.is_active
                            ? "bg-green/10 text-green border border-green/20"
                            : "bg-red/10 text-red border border-red/20"
                        }`}
                      >
                        {key.is_active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {key.is_active && (
                        <>
                          {revokeTarget === key.id ? (
                            <span className="flex items-center gap-1.5 justify-end">
                              <span className="text-[10px] text-amber">
                                Revoke?
                              </span>
                              <button
                                onClick={() => handleRevoke(key.id)}
                                disabled={revoking}
                                className="text-red hover:text-red/80 transition-colors text-[10px] font-semibold"
                              >
                                {revoking ? "..." : "Yes"}
                              </button>
                              <button
                                onClick={() => setRevokeTarget(null)}
                                className="text-text-dim hover:text-text transition-colors text-[10px]"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setRevokeTarget(key.id)}
                              className="text-text-muted hover:text-red transition-colors"
                              title="Revoke key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-[10px] text-text-muted space-y-1">
        <p>
          API keys use the format <code className="text-text-dim">tr_live_*</code>.
          Include them in the <code className="text-text-dim">Authorization: Bearer</code> header.
        </p>
        <p>
          Revoked keys cannot be reactivated. Create a new key if needed.
        </p>
      </div>
    </div>
  );
}
