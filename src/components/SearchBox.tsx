"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { searchTools, checkBeforeBuild } from "@/lib/api";
import type { Tool } from "@/lib/types";
import { ToolCard } from "./ToolCard";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tool[]>([]);
  const [checkResult, setCheckResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"search" | "check">("check");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setCheckResult(null);
    setResults([]);
    try {
      if (mode === "check") {
        const data = await checkBeforeBuild(query);
        setCheckResult(data as Record<string, unknown>);
      } else {
        const data = await searchTools(query);
        setResults(data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [query, mode]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("check")}
          className={`text-xs px-3 py-1 rounded transition-colors ${
            mode === "check"
              ? "bg-accent text-white"
              : "bg-bg-surface text-text-dim hover:text-text"
          }`}
        >
          check_before_build()
        </button>
        <button
          onClick={() => setMode("search")}
          className={`text-xs px-3 py-1 rounded transition-colors ${
            mode === "search"
              ? "bg-accent text-white"
              : "bg-bg-surface text-text-dim hover:text-text"
          }`}
        >
          search
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={
            mode === "check"
              ? "Describe what you need to build..."
              : "Search tools by name or capability..."
          }
          className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {loading && (
        <div className="text-center text-xs text-text-dim mt-4 animate-pulse">
          Querying the library...
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 grid gap-3">
          {results.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      )}

      {checkResult && (
        <div className="mt-4 bg-bg-card border border-border rounded-lg p-4">
          <pre className="text-xs text-text-dim overflow-auto max-h-96 whitespace-pre-wrap">
            {JSON.stringify(checkResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
