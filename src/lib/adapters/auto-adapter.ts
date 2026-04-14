import { createClient } from "@supabase/supabase-js";
import type { ToolAdapter, AdapterResult } from "../gateway-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface RouteMatch {
  adapterSlug: string;
  operation: string;
  confidence: number;
  reason: string;
}

interface ToolRouteResult {
  tool_name?: string;
  tool_slug?: string;
  rating?: number;
  confidence?: number;
  description?: string;
}

/**
 * Lazy import to break circular dependency:
 * gateway.ts -> auto-adapter.ts -> index.ts -> (all adapters) -> gateway-types
 * By deferring the import to runtime, we avoid the initialization cycle.
 */
function getRegistry(): {
  listAdapters: () => ToolAdapter[];
  getAdapter: (slug: string) => ToolAdapter | null;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("./index");
  return { listAdapters: mod.listAdapters, getAdapter: mod.getAdapter };
}

/**
 * Extract a URL from text or input object.
 */
function extractUrl(
  task: string,
  input: Record<string, unknown>
): string | null {
  if (input.url && typeof input.url === "string") return input.url;
  const urlMatch = task.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Heuristic routing: match task description to known adapter + operation combos.
 */
function heuristicRoute(
  task: string,
  input: Record<string, unknown>,
  availableSlugs: Set<string>
): RouteMatch | null {
  const t = task.toLowerCase();

  // Scrape / crawl + URL -> firecrawl or playwright
  if ((t.includes("scrape") || t.includes("crawl")) && extractUrl(task, input)) {
    if (availableSlugs.has("firecrawl")) {
      return {
        adapterSlug: "firecrawl",
        operation: t.includes("crawl") ? "crawl" : "scrape",
        confidence: 0.9,
        reason: "Task mentions scraping/crawling with a URL -- routing to Firecrawl",
      };
    }
    if (availableSlugs.has("playwright")) {
      return {
        adapterSlug: "playwright",
        operation: "scrape-text",
        confidence: 0.8,
        reason:
          "Task mentions scraping with a URL -- Firecrawl unavailable, using Playwright text scrape",
      };
    }
  }

  // Screenshot + URL -> playwright
  if (t.includes("screenshot") && extractUrl(task, input)) {
    if (availableSlugs.has("playwright")) {
      return {
        adapterSlug: "playwright",
        operation: "screenshot",
        confidence: 0.95,
        reason: "Task mentions screenshot with a URL -- routing to Playwright",
      };
    }
  }

  // Email / send -> resend (preferred) or sendgrid
  if (t.includes("email") || t.includes("send email") || t.includes("send mail")) {
    if (availableSlugs.has("resend")) {
      return {
        adapterSlug: "resend",
        operation: "send-email",
        confidence: 0.9,
        reason: "Task mentions email -- routing to Resend",
      };
    }
    if (availableSlugs.has("sendgrid")) {
      return {
        adapterSlug: "sendgrid",
        operation: "send-email",
        confidence: 0.85,
        reason: "Task mentions email -- routing to SendGrid",
      };
    }
  }

  // Voice / speech / audio / TTS -> elevenlabs
  if (
    t.includes("voice") ||
    t.includes("speech") ||
    t.includes("audio") ||
    t.includes("tts") ||
    t.includes("text to speech") ||
    t.includes("text-to-speech")
  ) {
    if (availableSlugs.has("elevenlabs")) {
      return {
        adapterSlug: "elevenlabs",
        operation: "text-to-speech",
        confidence: 0.9,
        reason: "Task mentions voice/speech/audio -- routing to ElevenLabs TTS",
      };
    }
  }

  // Transcribe -> whisper
  if (t.includes("transcribe")) {
    if (availableSlugs.has("whisper")) {
      return {
        adapterSlug: "whisper",
        operation: "transcribe",
        confidence: 0.9,
        reason: "Task mentions transcription -- routing to Whisper",
      };
    }
  }

  // Code / explain / write / chat -> claude
  if (
    t.includes("code") ||
    t.includes("explain") ||
    t.includes("write") ||
    t.includes("chat") ||
    t.includes("summarize") ||
    t.includes("analyze")
  ) {
    if (availableSlugs.has("claude")) {
      return {
        adapterSlug: "claude",
        operation: "chat",
        confidence: 0.75,
        reason: "Task mentions code/writing/analysis -- routing to Claude",
      };
    }
  }

  // GitHub search -> github
  if (
    (t.includes("search") && (t.includes("github") || t.includes("repo"))) ||
    t.includes("repository")
  ) {
    if (availableSlugs.has("github")) {
      return {
        adapterSlug: "github",
        operation: "search-repos",
        confidence: 0.9,
        reason: "Task mentions GitHub/repo search -- routing to GitHub",
      };
    }
  }

  // Docs / documentation / library -> context7
  if (
    t.includes("docs") ||
    t.includes("documentation") ||
    t.includes("library") ||
    t.includes("framework docs")
  ) {
    if (availableSlugs.has("context7")) {
      return {
        adapterSlug: "context7",
        operation: "query-docs",
        confidence: 0.85,
        reason: "Task mentions docs/documentation -- routing to Context7",
      };
    }
  }

  // SMS / text message -> twilio
  if (t.includes("sms") || t.includes("text message")) {
    if (availableSlugs.has("twilio")) {
      return {
        adapterSlug: "twilio",
        operation: "send-sms",
        confidence: 0.9,
        reason: "Task mentions SMS -- routing to Twilio",
      };
    }
  }

  // Database / SQL / query -> supabase
  if (
    t.includes("database") ||
    t.includes("sql") ||
    t.includes("query") ||
    t.includes("supabase")
  ) {
    if (availableSlugs.has("supabase")) {
      return {
        adapterSlug: "supabase",
        operation: "execute-sql",
        confidence: 0.8,
        reason: "Task mentions database/SQL -- routing to Supabase",
      };
    }
  }

  // Payment / charge / invoice / subscription -> stripe
  if (
    t.includes("payment") ||
    t.includes("charge") ||
    t.includes("invoice") ||
    t.includes("subscription") ||
    t.includes("stripe")
  ) {
    if (availableSlugs.has("stripe")) {
      return {
        adapterSlug: "stripe",
        operation: "list-customers",
        confidence: 0.8,
        reason: "Task mentions payments -- routing to Stripe",
      };
    }
  }

  return null;
}

/**
 * Map user-provided free-form input to the adapter's expected input format.
 */
function mapInput(
  adapterSlug: string,
  operation: string,
  task: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const url = extractUrl(task, input);
  const mapped: Record<string, unknown> = { ...input };

  // Ensure URL-based adapters get the url field
  if (url && !mapped.url) {
    mapped.url = url;
  }

  // For Claude chat, ensure messages exist
  if (adapterSlug === "claude" && (operation === "chat" || operation === "complete")) {
    if (!mapped.messages) {
      mapped.messages = [{ role: "user", content: input.prompt || task }];
    }
  }

  // For context7 query-docs, ensure query field
  if (adapterSlug === "context7" && operation === "query-docs") {
    if (!mapped.query) {
      mapped.query = input.library || input.topic || task;
    }
  }

  // For elevenlabs, ensure text field
  if (adapterSlug === "elevenlabs" && operation === "text-to-speech") {
    if (!mapped.text) {
      mapped.text = input.prompt || task;
    }
  }

  // For github search-repos, ensure query
  if (adapterSlug === "github" && operation === "search-repos") {
    if (!mapped.query && !mapped.q) {
      mapped.query = input.search || task;
    }
  }

  return mapped;
}

export const autoAdapter: ToolAdapter = {
  slug: "auto",
  name: "ToolRoute Auto",
  description:
    "Auto-routing -- describe what you need and ToolRoute picks the best tool and executes it. Like OpenRouter's openrouter/auto.",
  operations: ["route"],

  async execute(
    operation: string,
    input: Record<string, unknown>,
    byokKey?: string
  ): Promise<AdapterResult> {
    if (operation !== "route") {
      return {
        success: false,
        error: `Unknown operation: ${operation}. Auto adapter only supports "route".`,
        provider: "auto",
      };
    }

    const task = input.task as string;
    if (!task) {
      return {
        success: false,
        error:
          'Missing required field: "task" -- describe what you need (e.g. "scrape example.com and get the text")',
        provider: "auto",
      };
    }

    try {
      // Lazy-load registry to avoid circular dependency
      const { listAdapters, getAdapter } = getRegistry();

      // 1. Get all registered adapters
      const adapters = listAdapters();
      const availableSlugs = new Set(
        adapters
          .filter((a: ToolAdapter) => a.slug !== "auto") // Don't route to ourselves
          .map((a: ToolAdapter) => a.slug)
      );

      // 2. Try heuristic routing first (fast, no DB call)
      const heuristicMatch = heuristicRoute(task, input, availableSlugs);

      // 3. Also query check_before_build for registry intelligence
      let registryResults: ToolRouteResult[] = [];
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await supabase.rpc("check_before_build", {
          p_task: task,
        });
        if (!error && data) {
          const cbr = data as Record<string, unknown>;
          registryResults = (cbr.matching_tools as ToolRouteResult[]) ?? [];
        }
      } catch {
        // Non-fatal: proceed with heuristic only
      }

      // 4. Score and pick the best route
      let bestMatch: RouteMatch | null = heuristicMatch;

      // If no heuristic match, try to match registry results to available adapters
      if (!bestMatch && registryResults.length > 0) {
        for (const tool of registryResults) {
          const slug = tool.tool_slug ?? "";
          // Check if a slug prefix matches an adapter
          const adapterSlug = slug.split("/")[0];
          if (availableSlugs.has(adapterSlug)) {
            const adapter = getAdapter(adapterSlug);
            if (adapter) {
              const op = adapter.operations[0]; // Default to first operation
              bestMatch = {
                adapterSlug,
                operation: op,
                confidence: (tool.confidence ?? 0.5) * (tool.rating ?? 5) / 10,
                reason: `Registry match: ${tool.tool_name} (rating: ${tool.rating}, confidence: ${tool.confidence})`,
              };
              break;
            }
          }
        }
      }

      // 5. If still no match, return suggestions
      if (!bestMatch) {
        return {
          success: true,
          data: {
            routed: false,
            message:
              "No adapter matched your task. Please specify a tool directly (e.g. firecrawl/scrape).",
            available_adapters: adapters
              .filter((a: ToolAdapter) => a.slug !== "auto")
              .map((a: ToolAdapter) => ({
                slug: a.slug,
                name: a.name,
                description: a.description,
                operations: a.operations,
              })),
            registry_suggestions: registryResults.slice(0, 5).map((t) => ({
              name: t.tool_name,
              slug: t.tool_slug,
              rating: t.rating,
              description: t.description,
            })),
          },
          provider: "auto",
        };
      }

      // 6. Map the input and execute
      const adapter = getAdapter(bestMatch.adapterSlug);
      if (!adapter) {
        return {
          success: false,
          error: `Matched adapter "${bestMatch.adapterSlug}" is no longer available`,
          provider: "auto",
        };
      }

      const mappedInput = mapInput(
        bestMatch.adapterSlug,
        bestMatch.operation,
        task,
        input
      );

      const result = await adapter.execute(
        bestMatch.operation,
        mappedInput,
        byokKey
      );

      // 7. Return result with routing metadata
      return {
        success: result.success,
        data: {
          routing: {
            selected_tool: `${bestMatch.adapterSlug}/${bestMatch.operation}`,
            confidence: bestMatch.confidence,
            reason: bestMatch.reason,
            registry_alternatives: registryResults.slice(0, 3).map((t) => ({
              name: t.tool_name,
              slug: t.tool_slug,
              rating: t.rating,
            })),
          },
          result: result.data,
        },
        error: result.error,
        provider: `auto->${result.provider}`,
        units_consumed: result.units_consumed,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "auto" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    // Auto adapter is healthy if at least one underlying adapter is available
    const { listAdapters } = getRegistry();
    const adapters = listAdapters().filter((a: ToolAdapter) => a.slug !== "auto");
    return { healthy: adapters.length > 0, latency_ms: Date.now() - start };
  },

  estimateCost(operation: string, input: Record<string, unknown>): number {
    if (operation !== "route") return 0.005;

    // Try to estimate based on heuristic match
    const task = (input.task as string) ?? "";
    const { listAdapters, getAdapter } = getRegistry();
    const adapters = listAdapters();
    const availableSlugs = new Set(
      adapters.filter((a: ToolAdapter) => a.slug !== "auto").map((a: ToolAdapter) => a.slug)
    );

    const match = heuristicRoute(task, input, availableSlugs);
    if (match) {
      const adapter = getAdapter(match.adapterSlug);
      if (adapter) {
        return adapter.estimateCost(match.operation, input);
      }
    }

    return 0.005; // Default estimate
  },
};
