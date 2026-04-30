import { createClient } from "@supabase/supabase-js";
import type { ToolAdapter, AdapterResult } from "../gateway-types";
import { redactCreds } from "../redact-creds";

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

  // SMS / text message -> twilio (preferred) or textbelt (cheap)
  if (t.includes("sms") || t.includes("text message")) {
    // Cheap SMS preference
    if ((t.includes("cheap") || t.includes("textbelt")) && availableSlugs.has("textbelt")) {
      return {
        adapterSlug: "textbelt",
        operation: "send-sms",
        confidence: 0.9,
        reason: "Task mentions cheap SMS/textbelt -- routing to Textbelt",
      };
    }
    if (availableSlugs.has("twilio")) {
      return {
        adapterSlug: "twilio",
        operation: "send-sms",
        confidence: 0.9,
        reason: "Task mentions SMS -- routing to Twilio",
      };
    }
    if (availableSlugs.has("textbelt")) {
      return {
        adapterSlug: "textbelt",
        operation: "send-sms",
        confidence: 0.85,
        reason: "Task mentions SMS -- Twilio unavailable, routing to Textbelt",
      };
    }
  }

  // Stock photo / image search -> pexels or unsplash
  if (
    t.includes("stock photo") ||
    t.includes("stock image") ||
    (t.includes("photo") && (t.includes("find") || t.includes("search"))) ||
    t.includes("image of") ||
    t.includes("picture of") ||
    t.includes("stock video")
  ) {
    if (t.includes("stock video") || t.includes("video clip")) {
      if (availableSlugs.has("pexels")) {
        return {
          adapterSlug: "pexels",
          operation: "search-videos",
          confidence: 0.9,
          reason: "Task mentions stock video -- routing to Pexels video search",
        };
      }
    }
    if (availableSlugs.has("pexels")) {
      return {
        adapterSlug: "pexels",
        operation: "search-photos",
        confidence: 0.9,
        reason: "Task mentions stock photos/images -- routing to Pexels",
      };
    }
    if (availableSlugs.has("unsplash")) {
      return {
        adapterSlug: "unsplash",
        operation: "search",
        confidence: 0.85,
        reason: "Task mentions stock photos/images -- routing to Unsplash",
      };
    }
  }

  // Background removal -> removebg
  if (
    (t.includes("background") && (t.includes("remove") || t.includes("transparent"))) ||
    t.includes("cutout") ||
    t.includes("remove bg") ||
    t.includes("removebg")
  ) {
    if (availableSlugs.has("removebg")) {
      return {
        adapterSlug: "removebg",
        operation: "remove",
        confidence: 0.95,
        reason: "Task mentions background removal -- routing to RemoveBG",
      };
    }
  }

  // Phone call / voice call / AI call -> vapi
  if (
    t.includes("phone call") ||
    t.includes("voice call") ||
    t.includes("ai call") ||
    t.includes("call someone") ||
    t.includes("make a call") ||
    t.includes("vapi")
  ) {
    if (availableSlugs.has("vapi")) {
      return {
        adapterSlug: "vapi",
        operation: "create-call",
        confidence: 0.9,
        reason: "Task mentions phone/voice/AI call -- routing to Vapi",
      };
    }
  }

  // Create ad / video ad / UGC -> creatify
  if (
    t.includes("create ad") ||
    t.includes("video ad") ||
    t.includes("ugc") ||
    t.includes("advertisement") ||
    t.includes("creatify")
  ) {
    if (availableSlugs.has("creatify")) {
      return {
        adapterSlug: "creatify",
        operation: "create-ad",
        confidence: 0.9,
        reason: "Task mentions ad creation/UGC -- routing to Creatify",
      };
    }
  }

  // Find people / contacts / enrichment / prospects / leads -> apollo
  if (
    t.includes("find people") ||
    t.includes("contact") ||
    t.includes("enrichment") ||
    t.includes("prospect") ||
    t.includes("leads") ||
    t.includes("email lookup") ||
    t.includes("apollo")
  ) {
    if (availableSlugs.has("apollo")) {
      return {
        adapterSlug: "apollo",
        operation: "search-people",
        confidence: 0.9,
        reason: "Task mentions people/contact/lead search -- routing to Apollo",
      };
    }
  }

  // Shipping / labels / tracking -> shippo
  if (
    t.includes("shipping") ||
    t.includes("ship ") ||
    t.includes("label") ||
    t.includes("tracking") ||
    t.includes("package") ||
    t.includes("shippo")
  ) {
    const op = t.includes("track") ? "track" : "create-shipment";
    if (availableSlugs.has("shippo")) {
      return {
        adapterSlug: "shippo",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions shipping/tracking -- routing to Shippo",
      };
    }
  }

  // GPT / OpenAI / DALL-E -> openai
  if (
    t.includes("gpt") ||
    t.includes("openai") ||
    t.includes("dalle") ||
    t.includes("dall-e")
  ) {
    const op = (t.includes("dalle") || t.includes("dall-e") || t.includes("generate image")) ? "image" : "chat";
    if (availableSlugs.has("openai")) {
      return {
        adapterSlug: "openai",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions GPT/OpenAI/DALL-E -- routing to OpenAI",
      };
    }
  }

  // Replicate / ML model / Stable Diffusion -> replicate
  if (
    t.includes("replicate") ||
    t.includes("ml model") ||
    t.includes("stable diffusion") ||
    t.includes("sdxl")
  ) {
    if (availableSlugs.has("replicate")) {
      return {
        adapterSlug: "replicate",
        operation: "run",
        confidence: 0.9,
        reason: "Task mentions Replicate/ML model -- routing to Replicate",
      };
    }
  }

  // Error tracking / Sentry / bugs / crashes -> sentry
  if (
    t.includes("error") ||
    t.includes("sentry") ||
    t.includes("bugs") ||
    t.includes("crash") ||
    t.includes("issue tracker")
  ) {
    if (availableSlugs.has("sentry")) {
      return {
        adapterSlug: "sentry",
        operation: "list-issues",
        confidence: 0.85,
        reason: "Task mentions errors/bugs/crashes -- routing to Sentry",
      };
    }
  }

  // Google Maps / business listing / local business / reviews -> outscraper
  if (
    t.includes("google maps") ||
    t.includes("business listing") ||
    t.includes("local business") ||
    t.includes("reviews") ||
    t.includes("outscraper")
  ) {
    if (availableSlugs.has("outscraper")) {
      return {
        adapterSlug: "outscraper",
        operation: "google-maps",
        confidence: 0.9,
        reason: "Task mentions Google Maps/business listing -- routing to Outscraper",
      };
    }
  }

  // Deepgram / fast transcription -> deepgram
  if (t.includes("deepgram") || t.includes("fast transcri")) {
    if (availableSlugs.has("deepgram")) {
      return {
        adapterSlug: "deepgram",
        operation: "transcribe-url",
        confidence: 0.9,
        reason: "Task mentions Deepgram/fast transcription -- routing to Deepgram",
      };
    }
  }

  // Avatar video / talking head / HeyGen -> heygen
  if (
    t.includes("avatar video") ||
    t.includes("talking head") ||
    t.includes("heygen") ||
    t.includes("presenter video")
  ) {
    if (availableSlugs.has("heygen")) {
      return {
        adapterSlug: "heygen",
        operation: "create-video",
        confidence: 0.9,
        reason: "Task mentions avatar/talking head video -- routing to HeyGen",
      };
    }
  }

  // Higgsfield / Seedance / Cinema Studio / Soul 2 / multi-model video -> higgsfield
  if (
    t.includes("higgsfield") ||
    t.includes("seedance") ||
    t.includes("cinema studio") ||
    t.includes("soul 2") ||
    t.includes("soul-2")
  ) {
    if (availableSlugs.has("higgsfield")) {
      const isImage =
        t.includes("image") ||
        t.includes("soul 2") ||
        t.includes("soul-2") ||
        t.includes("flux");
      return {
        adapterSlug: "higgsfield",
        operation: isImage ? "generate-image" : "generate-video",
        confidence: 0.95,
        reason:
          "Task mentions Higgsfield/Seedance/Cinema Studio/Soul 2 -- routing to Higgsfield",
      };
    }
  }

  // Generic "ai video" fallback -> higgsfield (if not already matched by heygen/creatomate)
  if (
    (t.includes("ai video") || t.includes("generate video") || t.includes("text to video") || t.includes("text-to-video")) &&
    !t.includes("avatar") &&
    !t.includes("talking head") &&
    !t.includes("ad") &&
    !t.includes("ugc")
  ) {
    if (availableSlugs.has("higgsfield")) {
      return {
        adapterSlug: "higgsfield",
        operation: "generate-video",
        confidence: 0.8,
        reason: "Task mentions AI video generation -- routing to Higgsfield as multi-model platform",
      };
    }
  }

  // PDF generation -> pdf
  if (
    t.includes("pdf") ||
    t.includes("generate pdf") ||
    t.includes("report pdf")
  ) {
    const op = (t.includes("url") || t.includes("website")) ? "from-url" : "from-html";
    if (availableSlugs.has("pdf")) {
      return {
        adapterSlug: "pdf",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions PDF generation -- routing to PDF adapter",
      };
    }
  }

  // Translation -> translate (deepl)
  if (
    t.includes("translate") ||
    t.includes("translation") ||
    t.includes("in spanish") ||
    t.includes("in french") ||
    t.includes("in german") ||
    t.includes("in japanese") ||
    t.includes("in chinese") ||
    t.includes("in portuguese")
  ) {
    if (availableSlugs.has("translate")) {
      return {
        adapterSlug: "translate",
        operation: "text",
        confidence: 0.9,
        reason: "Task mentions translation -- routing to DeepL translate",
      };
    }
  }

  // Calendar / schedule / meeting -> calendar
  if (
    t.includes("calendar") ||
    t.includes("schedule") ||
    t.includes("meeting") ||
    t.includes("availability")
  ) {
    const op = (t.includes("create") || t.includes("add") || t.includes("schedule"))
      ? "create-event"
      : "list-events";
    if (availableSlugs.has("calendar")) {
      return {
        adapterSlug: "calendar",
        operation: op,
        confidence: 0.85,
        reason: "Task mentions calendar/schedule/meeting -- routing to Calendar",
      };
    }
  }

  // Google Drive / upload file / find file -> drive
  if (
    t.includes("drive") ||
    t.includes("google drive") ||
    t.includes("upload file") ||
    t.includes("find file")
  ) {
    const op = (t.includes("search") || t.includes("find")) ? "search" : "list-files";
    if (availableSlugs.has("drive")) {
      return {
        adapterSlug: "drive",
        operation: op,
        confidence: 0.85,
        reason: "Task mentions Google Drive/file management -- routing to Drive",
      };
    }
  }

  // Exa neural search / find similar / research / AI search
  if (
    t.includes("exa") ||
    t.includes("neural search") ||
    t.includes("find similar") ||
    (t.includes("research") && (t.includes("deep") || t.includes("paper") || t.includes("company")))
  ) {
    if (availableSlugs.has("exa")) {
      const op = t.includes("similar") ? "find-similar" : "search";
      return {
        adapterSlug: "exa",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions Exa/neural search/find similar -- routing to Exa",
      };
    }
  }

  // Tavily RAG search / extract content
  if (
    t.includes("tavily") ||
    t.includes("rag search") ||
    t.includes("extract content") ||
    t.includes("extract url")
  ) {
    if (availableSlugs.has("tavily")) {
      const op = (t.includes("extract")) ? "extract" : "search";
      return {
        adapterSlug: "tavily",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions Tavily/RAG search/extract -- routing to Tavily",
      };
    }
  }

  // Twitter / X / tweet
  if (
    t.includes("tweet") ||
    t.includes("post to twitter") ||
    t.includes("post to x") ||
    t.includes("twitter") ||
    (t.includes("post") && t.includes(" x "))
  ) {
    if (availableSlugs.has("twitter")) {
      const op = t.includes("search") ? "search-tweets" :
        t.includes("mention") ? "get-mentions" :
        t.includes("delete") ? "delete-tweet" :
        t.includes("user") || t.includes("profile") ? "get-user" :
        "post-tweet";
      return {
        adapterSlug: "twitter",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions Twitter/X/tweet -- routing to Twitter",
      };
    }
  }

  // LinkedIn
  if (
    t.includes("linkedin") ||
    t.includes("post to linkedin")
  ) {
    if (availableSlugs.has("linkedin")) {
      const op = t.includes("profile") ? "get-profile" : "create-post";
      return {
        adapterSlug: "linkedin",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions LinkedIn -- routing to LinkedIn",
      };
    }
  }

  // YouTube
  if (
    t.includes("youtube") ||
    t.includes("upload video") ||
    t.includes("youtube comments")
  ) {
    if (availableSlugs.has("youtube")) {
      const op = t.includes("upload") ? "upload-video" :
        t.includes("comment") ? "get-comments" :
        t.includes("search") ? "search" :
        "list-videos";
      return {
        adapterSlug: "youtube",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions YouTube -- routing to YouTube",
      };
    }
  }

  // Slack
  if (
    t.includes("slack") ||
    t.includes("send to slack") ||
    t.includes("slack message")
  ) {
    if (availableSlugs.has("slack")) {
      const op = t.includes("read") || t.includes("history") ? "read-channel" :
        t.includes("list") || t.includes("channels") ? "list-channels" :
        t.includes("reply") || t.includes("thread") ? "reply-thread" :
        "send-message";
      return {
        adapterSlug: "slack",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions Slack -- routing to Slack",
      };
    }
  }

  // Web search -> search
  if (
    (t.includes("search") && (t.includes("web") || t.includes("google") || t.includes("bing"))) ||
    t.includes("search the web") ||
    t.includes("look up")
  ) {
    if (availableSlugs.has("search")) {
      return {
        adapterSlug: "search",
        operation: "web",
        confidence: 0.8,
        reason: "Task mentions web search -- routing to Search adapter",
      };
    }
  }

  // Image generation (generic) -> image
  if (
    (t.includes("generate") && t.includes("image")) ||
    t.includes("create image") ||
    t.includes("ai image") ||
    t.includes("image generation")
  ) {
    if (availableSlugs.has("image")) {
      return {
        adapterSlug: "image",
        operation: "generate",
        confidence: 0.85,
        reason: "Task mentions image generation -- routing to Image adapter",
      };
    }
  }

  // Screenshot (without URL already matched above) -> screenshot
  if (t.includes("screenshot") || t.includes("capture page")) {
    if (availableSlugs.has("screenshot")) {
      return {
        adapterSlug: "screenshot",
        operation: "capture",
        confidence: 0.8,
        reason: "Task mentions screenshot -- routing to Screenshot adapter",
      };
    }
  }

  // Notion / notes / wiki / workspace -> notion
  if (
    t.includes("notion") ||
    t.includes("wiki") ||
    (t.includes("workspace") && (t.includes("search") || t.includes("page") || t.includes("create"))) ||
    (t.includes("notes") && (t.includes("search") || t.includes("create") || t.includes("database")))
  ) {
    if (availableSlugs.has("notion")) {
      const op = (t.includes("create") || t.includes("add") || t.includes("new"))
        ? "create-page"
        : (t.includes("database") || t.includes("query")) ? "query-database"
        : "search";
      return {
        adapterSlug: "notion",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions Notion/wiki/workspace/notes -- routing to Notion",
      };
    }
  }

  // HubSpot / CRM / deal / pipeline / sales contact -> hubspot
  if (
    t.includes("hubspot") ||
    (t.includes("crm") && !t.includes("jarviscrm")) ||
    t.includes("deal") ||
    t.includes("pipeline") ||
    (t.includes("sales") && t.includes("contact"))
  ) {
    if (availableSlugs.has("hubspot")) {
      const op = t.includes("deal") ? "create-deal" :
        t.includes("search") || t.includes("find") ? "search-contacts" :
        t.includes("note") ? "create-note" :
        t.includes("list") ? "list-deals" :
        "create-contact";
      return {
        adapterSlug: "hubspot",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions HubSpot/CRM/deal/pipeline -- routing to HubSpot",
      };
    }
  }

  // Google Sheets / spreadsheet / csv data -> sheets
  if (
    t.includes("spreadsheet") ||
    t.includes("sheets") ||
    t.includes("google sheets") ||
    t.includes("csv data")
  ) {
    if (availableSlugs.has("sheets")) {
      const op = (t.includes("write") || t.includes("update")) ? "write-range" :
        (t.includes("append") || t.includes("add row")) ? "append-row" :
        "read-range";
      return {
        adapterSlug: "sheets",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions spreadsheet/sheets/csv -- routing to Google Sheets",
      };
    }
  }

  // Linear / ticket / issue / project management / sprint -> linear
  if (
    t.includes("linear") ||
    t.includes("ticket") ||
    (t.includes("issue") && !t.includes("github")) ||
    (t.includes("project management") || t.includes("sprint") || t.includes("backlog"))
  ) {
    if (availableSlugs.has("linear")) {
      const op = (t.includes("create") || t.includes("new") || t.includes("add")) ? "create-issue" :
        (t.includes("update") || t.includes("move") || t.includes("assign")) ? "update-issue" :
        (t.includes("project") && (t.includes("list") || t.includes("show"))) ? "list-projects" :
        "list-issues";
      return {
        adapterSlug: "linear",
        operation: op,
        confidence: 0.9,
        reason: "Task mentions Linear/ticket/issue/sprint -- routing to Linear",
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

  // For pexels/unsplash photo search, ensure query
  if ((adapterSlug === "pexels" || adapterSlug === "unsplash") && !mapped.query) {
    mapped.query = input.search || input.topic || task;
  }

  // For translate, ensure text and target_lang
  if (adapterSlug === "translate" && operation === "text") {
    if (!mapped.text) {
      mapped.text = input.content || input.prompt || task;
    }
  }

  // For openai chat, ensure messages exist
  if (adapterSlug === "openai" && operation === "chat") {
    if (!mapped.messages) {
      mapped.messages = [{ role: "user", content: input.prompt || task }];
    }
  }

  // For openai image, ensure prompt
  if (adapterSlug === "openai" && operation === "image") {
    if (!mapped.prompt) {
      mapped.prompt = input.description || task;
    }
  }

  // For apollo search-people, ensure query
  if (adapterSlug === "apollo" && operation === "search-people") {
    if (!mapped.query && !mapped.q) {
      mapped.query = input.search || input.name || task;
    }
  }

  // For pdf, ensure html or url
  if (adapterSlug === "pdf") {
    if (operation === "from-html" && !mapped.html) {
      mapped.html = input.content || input.body || task;
    }
    if (operation === "from-url" && !mapped.url) {
      const pdfUrl = extractUrl(task, input);
      if (pdfUrl) mapped.url = pdfUrl;
    }
  }

  // For textbelt, ensure phone and message
  if (adapterSlug === "textbelt" && operation === "send-sms") {
    if (!mapped.message) {
      mapped.message = input.body || input.text || task;
    }
  }

  // For shippo, ensure address/parcel fields passthrough
  // (complex inputs -- let user provide structured data)

  // For removebg, ensure image_url
  if (adapterSlug === "removebg" && operation === "remove") {
    if (!mapped.image_url && !mapped.image) {
      const imgUrl = extractUrl(task, input);
      if (imgUrl) mapped.image_url = imgUrl;
    }
  }

  // For exa search, ensure query
  if (adapterSlug === "exa" && (operation === "search" || operation === "search-companies" || operation === "search-people")) {
    if (!mapped.query) {
      mapped.query = input.search || input.topic || task;
    }
  }

  // For exa find-similar, ensure url
  if (adapterSlug === "exa" && operation === "find-similar") {
    if (!mapped.url) {
      const exaUrl = extractUrl(task, input);
      if (exaUrl) mapped.url = exaUrl;
    }
  }

  // For tavily search, ensure query
  if (adapterSlug === "tavily" && operation === "search") {
    if (!mapped.query) {
      mapped.query = input.search || input.topic || task;
    }
  }

  // For tavily extract, ensure urls
  if (adapterSlug === "tavily" && operation === "extract") {
    if (!mapped.urls) {
      const tavUrl = extractUrl(task, input);
      if (tavUrl) mapped.urls = [tavUrl];
    }
  }

  // For twitter post-tweet, ensure text
  if (adapterSlug === "twitter" && operation === "post-tweet") {
    if (!mapped.text) {
      mapped.text = input.content || input.message || task;
    }
  }

  // For twitter search-tweets, ensure query
  if (adapterSlug === "twitter" && operation === "search-tweets") {
    if (!mapped.query) {
      mapped.query = input.search || input.topic || task;
    }
  }

  // For linkedin create-post, ensure text
  if (adapterSlug === "linkedin" && operation === "create-post") {
    if (!mapped.text) {
      mapped.text = input.content || input.message || task;
    }
  }

  // For youtube search, ensure query
  if (adapterSlug === "youtube" && operation === "search") {
    if (!mapped.query) {
      mapped.query = input.search || input.topic || task;
    }
  }

  // For slack send-message, ensure text
  if (adapterSlug === "slack" && (operation === "send-message" || operation === "reply-thread")) {
    if (!mapped.text) {
      mapped.text = input.content || input.message || task;
    }
  }

  return mapped;
}

/** Adapters known to work without any API key */
const FREE_ADAPTERS = ["toolroute", "context7", "playwright", "github", "pexels", "unsplash"];

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

      // 6b. Execute with graceful fallback on API key / provider errors
      let result: AdapterResult;
      try {
        result = await adapter.execute(
          bestMatch.operation,
          mappedInput,
          byokKey
        );
      } catch (execErr) {
        // Execution failed (likely missing API key) -- return routing info + alternatives
        const execMessage =
          execErr instanceof Error ? execErr.message : String(execErr);
        const isKeyError =
          /api.?key|unauthorized|forbidden|auth|credential|BYOK|missing.*key/i.test(
            execMessage
          );

        const freeAlternatives = adapters
          .filter(
            (a: ToolAdapter) =>
              a.slug !== "auto" && FREE_ADAPTERS.includes(a.slug)
          )
          .map((a: ToolAdapter) => ({
            slug: a.slug,
            name: a.name,
            description: a.description,
            operations: a.operations,
          }));

        return {
          success: true, // Routing succeeded even though execution failed
          data: {
            routing: {
              adapter: bestMatch.adapterSlug,
              operation: bestMatch.operation,
              confidence: bestMatch.confidence,
              reason: bestMatch.reason,
            },
            execution_failed: true,
            error: isKeyError
              ? `Tool "${bestMatch.adapterSlug}" requires an API key. Set up BYOK at https://toolroute.ai/dashboard/providers or use a free alternative.`
              : redactCreds(`Tool "${bestMatch.adapterSlug}" execution failed: ${execMessage}`),
            suggestions: [
              "Use toolroute/check_before_build to find alternatives",
              "Use github/search-repos (no key needed)",
              "Use playwright/scrape-text (no key needed)",
              "Use context7/search (no key needed)",
            ],
            free_alternatives: freeAlternatives,
            check_results: registryResults.slice(0, 5).map((t) => ({
              name: t.tool_name,
              slug: t.tool_slug,
              rating: t.rating,
              description: t.description,
            })),
          },
          provider: `auto->${bestMatch.adapterSlug}`,
        };
      }

      // Also handle non-throwing failures (adapter returned success: false)
      if (!result.success) {
        const isKeyError =
          /api.?key|unauthorized|forbidden|auth|credential|BYOK|missing.*key/i.test(
            result.error ?? ""
          );

        if (isKeyError) {
          const freeAlternatives = adapters
            .filter(
              (a: ToolAdapter) =>
                a.slug !== "auto" && FREE_ADAPTERS.includes(a.slug)
            )
            .map((a: ToolAdapter) => ({
              slug: a.slug,
              name: a.name,
              description: a.description,
              operations: a.operations,
            }));

          return {
            success: true,
            data: {
              routing: {
                adapter: bestMatch.adapterSlug,
                operation: bestMatch.operation,
                confidence: bestMatch.confidence,
                reason: bestMatch.reason,
              },
              execution_failed: true,
              error: `Tool "${bestMatch.adapterSlug}" requires an API key. Set up BYOK at https://toolroute.ai/dashboard/providers or use a free alternative.`,
              suggestions: [
                "Use toolroute/check_before_build to find alternatives",
                "Use github/search-repos (no key needed)",
                "Use playwright/scrape-text (no key needed)",
                "Use context7/search (no key needed)",
              ],
              free_alternatives: freeAlternatives,
              check_results: registryResults.slice(0, 5).map((t) => ({
                name: t.tool_name,
                slug: t.tool_slug,
                rating: t.rating,
                description: t.description,
              })),
            },
            provider: `auto->${bestMatch.adapterSlug}`,
          };
        }
      }

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
      return { success: false, error: redactCreds(message), provider: "auto" };
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
