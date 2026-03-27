"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import type { Tool } from "@/lib/types";
import { SUPER_CATEGORIES } from "@/lib/types";
import { ToolCard } from "@/components/ToolCard";

interface Props {
  tools: Tool[];
  installedSlugs: string[];
}

export function ToolsClient({ tools, installedSlugs }: Props) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [protocolFilter, setProtocolFilter] = useState<string>("all");
  const [showInstalled, setShowInstalled] = useState(false);

  const protocols = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => t.protocols?.forEach((p) => set.add(p)));
    return Array.from(set).sort();
  }, [tools]);

  const filtered = useMemo(() => {
    return tools.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter !== "all" && t.super_category !== catFilter) return false;
      if (protocolFilter !== "all" && !t.protocols?.includes(protocolFilter)) return false;
      if (showInstalled && !installedSlugs.includes(t.slug)) return false;
      return true;
    });
  }, [tools, search, catFilter, protocolFilter, showInstalled, installedSlugs]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="w-full bg-bg-card border border-border rounded pl-9 pr-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="bg-bg-card border border-border rounded pl-7 pr-6 py-2 text-xs text-text appearance-none cursor-pointer focus:outline-none focus:border-accent"
          >
            <option value="all">All Categories</option>
            {SUPER_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <select
          value={protocolFilter}
          onChange={(e) => setProtocolFilter(e.target.value)}
          className="bg-bg-card border border-border rounded px-3 py-2 text-xs text-text appearance-none cursor-pointer focus:outline-none focus:border-accent"
        >
          <option value="all">All Protocols</option>
          {protocols.map((p) => (
            <option key={p} value={p}>
              {p.toUpperCase()}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowInstalled(!showInstalled)}
          className={`text-xs px-3 py-2 rounded border transition-colors ${
            showInstalled
              ? "bg-green/15 border-green/30 text-green"
              : "bg-bg-card border-border text-text-dim hover:text-text"
          }`}
        >
          Installed ({installedSlugs.length})
        </button>
      </div>

      {/* Results count */}
      <p className="text-xs text-text-muted mb-4">
        {filtered.length} tool{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((t) => (
          <div key={t.id} className="relative">
            {installedSlugs.includes(t.slug) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green rounded-full border-2 border-bg z-10" title="Installed" />
            )}
            <ToolCard tool={t} />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-text-dim text-sm">
          No tools match your filters.
        </div>
      )}
    </div>
  );
}
