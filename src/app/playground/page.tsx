"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Loader2,
  Clock,
  ChevronDown,
  X,
  Key,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tool catalog grouped by category                                    */
/* ------------------------------------------------------------------ */

interface ToolEntry {
  slug: string;
  label: string;
}

interface CategoryGroup {
  label: string;
  tools: ToolEntry[];
}

const TOOL_CATALOG: CategoryGroup[] = [
  {
    label: "AI & LLM",
    tools: [
      { slug: "claude/chat", label: "Claude Chat (BYOK required)" },
      { slug: "openai/chat", label: "OpenAI Chat (BYOK required)" },
      { slug: "openai/image", label: "OpenAI Image (BYOK required)" },
      { slug: "replicate/run", label: "Replicate Run (BYOK required)" },
    ],
  },
  {
    label: "Search",
    tools: [
      { slug: "search/web", label: "Web Search (BYOK required)" },
      { slug: "context7/search", label: "Context7 Docs (BYOK required)" },
      { slug: "firecrawl/scrape", label: "Firecrawl Scrape" },
    ],
  },
  {
    label: "Voice",
    tools: [
      { slug: "elevenlabs/text-to-speech", label: "ElevenLabs TTS (BYOK required)" },
      { slug: "deepgram/transcribe-url", label: "Deepgram Transcribe" },
      { slug: "vapi/create-call", label: "Vapi Create Call (BYOK required)" },
    ],
  },
  {
    label: "Email",
    tools: [
      { slug: "sendgrid/send-email", label: "SendGrid Email (BYOK required)" },
      { slug: "resend/send-email", label: "Resend Email (BYOK required)" },
    ],
  },
  {
    label: "Image",
    tools: [
      { slug: "image/generate", label: "Image Generate" },
      { slug: "pexels/search-photos", label: "Pexels Photos" },
      { slug: "unsplash/search", label: "Unsplash Search (BYOK required)" },
      { slug: "removebg/remove", label: "RemoveBG" },
    ],
  },
  {
    label: "Video",
    tools: [
      { slug: "heygen/create-video", label: "HeyGen Video (BYOK required)" },
      { slug: "creatomate/render", label: "Creatomate Render" },
      { slug: "shotstack/render", label: "Shotstack Render (BYOK required)" },
      { slug: "mux/create-asset", label: "Mux Asset (BYOK required)" },
    ],
  },
  {
    label: "Business",
    tools: [
      { slug: "stripe/list-products", label: "Stripe Products (BYOK required)" },
      { slug: "apollo/search-people", label: "Apollo People" },
      { slug: "shippo/create-shipment", label: "Shippo Shipment" },
    ],
  },
  {
    label: "Translation",
    tools: [{ slug: "translate/text", label: "Translate Text (BYOK required)" }],
  },
  {
    label: "Platform",
    tools: [
      { slug: "toolroute/check_before_build", label: "Check Before Build" },
      { slug: "auto/route", label: "Auto Route" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Example inputs per tool                                             */
/* ------------------------------------------------------------------ */

// Class-A providers (claude, openai, replicate, search, context7, elevenlabs,
// vapi, sendgrid, resend, unsplash, heygen, shotstack, mux, stripe) require
// BYOK — register your provider key via /api/v1/byok before calling them.
const EXAMPLES: Record<string, Record<string, unknown>> = {
  // BYOK required (Class-A premium provider)
  "search/web": { query: "best AI tools 2026", num_results: 5 },
  // BYOK required (Class-A premium provider)
  "claude/chat": {
    messages: [{ role: "user", content: "What is ToolRoute?" }],
    max_tokens: 200,
  },
  // BYOK required (Class-A premium provider)
  "openai/chat": {
    messages: [{ role: "user", content: "Explain API gateways in one paragraph" }],
    max_tokens: 200,
  },
  // BYOK required (Class-A premium provider)
  "openai/image": {
    prompt: "A futuristic city skyline at sunset, cyberpunk style",
    size: "1024x1024",
  },
  // BYOK required (Class-A premium provider)
  "replicate/run": {
    model: "stability-ai/sdxl",
    input: { prompt: "A photorealistic mountain landscape" },
  },
  // BYOK required (Class-A premium provider)
  "context7/search": { query: "Next.js app router", library: "nextjs" },
  "firecrawl/scrape": { url: "https://example.com", formats: ["markdown"] },
  // BYOK required (Class-A premium provider)
  "elevenlabs/text-to-speech": {
    text: "Hello from ToolRoute, the OpenRouter for tools.",
    voice_id: "21m00Tcm4TlvDq8ikWAM",
  },
  "deepgram/transcribe-url": {
    url: "https://example.com/audio.mp3",
    model: "nova-2",
  },
  // BYOK required (Class-A premium provider)
  "vapi/create-call": {
    phone_number: "+15551234567",
    assistant_id: "your-assistant-id",
  },
  // BYOK required (Class-A premium provider)
  "sendgrid/send-email": {
    to: "user@example.com",
    from: "hello@toolroute.ai",
    subject: "Test from ToolRoute",
    text: "This is a test email sent via ToolRoute.",
  },
  // BYOK required (Class-A premium provider)
  "resend/send-email": {
    to: "user@example.com",
    from: "hello@toolroute.ai",
    subject: "Test from ToolRoute",
    html: "<p>This is a test email sent via ToolRoute.</p>",
  },
  "image/generate": {
    prompt: "A minimalist logo for a tech startup",
    width: 512,
    height: 512,
  },
  "pexels/search-photos": { query: "sunset beach", per_page: 3 },
  // BYOK required (Class-A premium provider)
  "unsplash/search": { query: "mountains", per_page: 3 },
  "removebg/remove": { image_url: "https://example.com/photo.jpg" },
  // BYOK required (Class-A premium provider)
  "heygen/create-video": {
    script: "Welcome to ToolRoute, the OpenRouter for tools.",
    avatar_id: "default",
  },
  "creatomate/render": {
    template_id: "your-template-id",
    modifications: { "Title.text": "Hello World" },
  },
  // BYOK required (Class-A premium provider)
  "shotstack/render": {
    timeline: {
      tracks: [{ clips: [{ asset: { type: "title", text: "Hello" } }] }],
    },
    output: { format: "mp4" },
  },
  // BYOK required (Class-A premium provider)
  "mux/create-asset": { input: "https://example.com/video.mp4" },
  // BYOK required (Class-A premium provider)
  "stripe/list-products": { limit: 5 },
  "apollo/search-people": {
    q_keywords: "CEO SaaS",
    per_page: 3,
  },
  "shippo/create-shipment": {
    address_from: { city: "San Francisco", state: "CA", zip: "94107", country: "US" },
    address_to: { city: "New York", state: "NY", zip: "10001", country: "US" },
    parcels: [{ length: 10, width: 8, height: 4, weight: 2 }],
  },
  // BYOK required (Class-A premium provider — DeepL, register key via /api/v1/byok)
  "translate/text": {
    text: "Hello, how are you?",
    target_lang: "ES",
  },
  "toolroute/check_before_build": {
    task: "I need to send transactional emails",
  },
  "auto/route": {
    task: "Find stock photos of a sunset on a beach",
  },
};

/* ------------------------------------------------------------------ */
/* History entry                                                       */
/* ------------------------------------------------------------------ */

interface HistoryEntry {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  timestamp: number;
}

const HISTORY_KEY = "tr_playground_history";
const API_KEY_KEY = "tr_playground_api_key";

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 10)));
}

/* ------------------------------------------------------------------ */
/* JSON syntax highlighting (lightweight, no deps)                     */
/* ------------------------------------------------------------------ */

function highlightJson(obj: unknown): string {
  const raw = JSON.stringify(obj, null, 2);
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /"([^"\\]|\\.)*"\s*:/g,
      (m) => `<span class="text-purple">${m.slice(0, -1)}</span>:`
    )
    .replace(
      /:\s*"([^"\\]|\\.)*"/g,
      (m) => `: <span class="text-green">${m.slice(2)}</span>`
    )
    .replace(
      /:\s*(\d+\.?\d*)/g,
      (_, n) => `: <span class="text-amber">${n}</span>`
    )
    .replace(
      /:\s*(true|false|null)/g,
      (_, v) => `: <span class="text-cyan">${v}</span>`
    );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function PlaygroundPage() {
  const allTools = TOOL_CATALOG.flatMap((g) => g.tools);
  // Default to search/web (BYOK required — Class-A premium provider)
  const defaultSlug = "search/web";

  const [selectedTool, setSelectedTool] = useState(defaultSlug);
  const [inputText, setInputText] = useState(
    JSON.stringify(EXAMPLES[defaultSlug] ?? {}, null, 2)
  );
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load persisted state
  useEffect(() => {
    setHistory(loadHistory());
    const savedKey = localStorage.getItem(API_KEY_KEY) ?? "";
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Persist API key
  useEffect(() => {
    if (apiKey) localStorage.setItem(API_KEY_KEY, apiKey);
  }, [apiKey]);

  // Update example when tool changes
  const handleToolChange = useCallback(
    (slug: string) => {
      setSelectedTool(slug);
      setInputText(JSON.stringify(EXAMPLES[slug] ?? {}, null, 2));
      setResponse(null);
      setError(null);
      setDropdownOpen(false);
    },
    []
  );

  // Execute
  const handleExecute = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("API key is required. Enter your tr_live_xxx key above.");
      return;
    }

    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputText);
    } catch {
      setError("Invalid JSON input. Please fix the syntax and try again.");
      return;
    }

    setExecuting(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/v1/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ tool: selectedTool, input: parsedInput }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(
          json.error?.message ??
            json.error ??
            `Request failed with status ${res.status}`
        );
        setResponse(json);
      } else {
        setResponse(json);
      }

      // Save to history
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        tool: selectedTool,
        input: parsedInput,
        timestamp: Date.now(),
      };
      const updated = [entry, ...history].slice(0, 10);
      setHistory(updated);
      saveHistory(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error. Check your connection."
      );
    } finally {
      setExecuting(false);
    }
  }, [apiKey, inputText, selectedTool, history]);

  // Replay history
  const handleReplay = useCallback(
    (entry: HistoryEntry) => {
      setSelectedTool(entry.tool);
      setInputText(JSON.stringify(entry.input, null, 2));
      setResponse(null);
      setError(null);
    },
    []
  );

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const currentLabel =
    allTools.find((t) => t.slug === selectedTool)?.label ?? selectedTool;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-slide-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">API Playground</h1>
        <p className="text-xs text-text-dim mt-1">
          Test any tool in real-time. Select a tool, edit the input, and hit Execute.
        </p>
      </div>

      {/* API Key Bar */}
      <div className="mb-6 border border-border rounded-lg bg-bg-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Key className="w-4 h-4 text-text-muted shrink-0" />
          <label className="text-[10px] uppercase tracking-wider text-text-muted shrink-0">
            API Key
          </label>
          <div className="flex-1 min-w-[200px] relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tr_live_xxxxxxxxxxxxxxxx"
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={() => setShowKey(!showKey)}
            className="text-[10px] text-text-dim hover:text-accent transition-colors"
          >
            {showKey ? "Hide" : "Show"}
          </button>
          <span className="text-[10px] text-text-muted hidden sm:inline">
            Stored in localStorage only
          </span>
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left: Input Panel */}
        <div className="space-y-4">
          {/* Tool Selector */}
          <div className="border border-border rounded-lg bg-bg-card p-4">
            <label className="text-[10px] uppercase tracking-wider text-text-muted mb-2 block">
              Tool
            </label>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between bg-bg-surface border border-border rounded px-3 py-2 text-xs text-text hover:border-accent/50 transition-colors"
              >
                <span>
                  <code className="text-accent">{selectedTool}</code>
                  <span className="text-text-dim ml-2">{currentLabel}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-text-muted transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-bg-card border border-border rounded-lg shadow-xl">
                  {TOOL_CATALOG.map((group) => (
                    <div key={group.label}>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted bg-bg-surface/50 sticky top-0">
                        {group.label}
                      </div>
                      {group.tools.map((tool) => (
                        <button
                          key={tool.slug}
                          onClick={() => handleToolChange(tool.slug)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-surface transition-colors flex items-center justify-between ${
                            selectedTool === tool.slug
                              ? "text-accent bg-accent/5"
                              : "text-text"
                          }`}
                        >
                          <code>{tool.slug}</code>
                          <span className="text-text-dim text-[10px]">
                            {tool.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* JSON Input */}
          <div className="border border-border rounded-lg bg-bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-wider text-text-muted">
                Input (JSON)
              </label>
              <button
                onClick={() =>
                  setInputText(
                    JSON.stringify(EXAMPLES[selectedTool] ?? {}, null, 2)
                  )
                }
                className="text-[10px] text-accent hover:underline"
              >
                Reset example
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              spellCheck={false}
              rows={14}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-xs text-text font-mono resize-y focus:outline-none focus:border-accent transition-colors leading-relaxed"
            />
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecute}
            disabled={executing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Execute
              </>
            )}
          </button>

          {/* Request History */}
          {history.length > 0 && (
            <div className="border border-border rounded-lg bg-bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Recent Requests
                </label>
                <button
                  onClick={handleClearHistory}
                  className="text-[10px] text-text-dim hover:text-red transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleReplay(entry)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-surface border border-border text-[10px] text-text-dim hover:text-accent hover:border-accent/30 transition-colors"
                    title={`${entry.tool} - ${new Date(entry.timestamp).toLocaleTimeString()}`}
                  >
                    <code>{entry.tool}</code>
                    <span className="text-text-muted">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Response Panel */}
        <div className="space-y-4">
          <div
            className={`border rounded-lg bg-bg-card p-4 min-h-[400px] ${
              error ? "border-red/30" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] uppercase tracking-wider text-text-muted">
                Response
              </label>
              {response && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(response, null, 2)
                    );
                    setCopiedResponse(true);
                    setTimeout(() => setCopiedResponse(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[10px] text-text-dim hover:text-accent transition-colors"
                >
                  {copiedResponse ? (
                    <>
                      <Check className="w-3 h-3 text-green" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 mb-3 p-3 rounded bg-red/5 border border-red/20">
                <AlertCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />
                <p className="text-xs text-red">{error}</p>
              </div>
            )}

            {/* Loading state */}
            {executing && !response && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-xs">Executing {selectedTool}...</p>
              </div>
            )}

            {/* Empty state */}
            {!executing && !response && !error && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <Play className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-xs">
                  Select a tool and click Execute to see the response here.
                </p>
              </div>
            )}

            {/* Response metadata */}
            {response && (
              <div className="space-y-3">
                {/* Quick stats */}
                {(response.request_id != null ||
                  response.tool != null ||
                  response.usage != null) && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {response.request_id != null && (
                      <span className="px-2 py-0.5 rounded bg-bg-surface border border-border text-text-dim">
                        ID: {String(response.request_id).slice(0, 12)}...
                      </span>
                    )}
                    {response.tool != null && (
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent">
                        {String(response.tool)}
                      </span>
                    )}
                    {(response.usage as Record<string, unknown>)?.latency_ms != null && (
                      <span className="px-2 py-0.5 rounded bg-cyan/10 border border-cyan/20 text-cyan">
                        {String(
                          (response.usage as Record<string, unknown>).latency_ms
                        )}
                        ms
                      </span>
                    )}
                    {(response.usage as Record<string, unknown>)?.cost != null && (
                      <span className="px-2 py-0.5 rounded bg-green/10 border border-green/20 text-green">
                        $
                        {Number(
                          (response.usage as Record<string, unknown>).cost
                        ).toFixed(4)}
                      </span>
                    )}
                    {(response.usage as Record<string, unknown>)?.balance != null && (
                      <span className="px-2 py-0.5 rounded bg-amber/10 border border-amber/20 text-amber">
                        Balance: $
                        {Number(
                          (response.usage as Record<string, unknown>).balance
                        ).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {/* JSON body */}
                <pre
                  className="text-xs leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto p-3 rounded bg-bg-surface border border-border"
                  dangerouslySetInnerHTML={{
                    __html: highlightJson(response),
                  }}
                />
              </div>
            )}
          </div>

          {/* cURL preview */}
          <div className="border border-border rounded-lg bg-bg-card p-4">
            <label className="text-[10px] uppercase tracking-wider text-text-muted mb-2 block">
              cURL equivalent
            </label>
            <pre className="text-[10px] leading-relaxed text-text-dim overflow-x-auto p-3 rounded bg-bg-surface border border-border whitespace-pre-wrap break-all">
              {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || "tr_live_xxx"}" \\
  -d '${JSON.stringify({ tool: selectedTool, input: (() => { try { return JSON.parse(inputText); } catch { return {}; } })() })}'`}
            </pre>
          </div>
        </div>
      </div>

      {/* Click-away overlay for dropdown */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}
