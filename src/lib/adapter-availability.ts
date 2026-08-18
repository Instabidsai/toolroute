import type { ToolAdapter } from "./gateway-types";
import {
  AMBIGUOUS_DEFAULT_BYOK_SLUGS,
  BYOK_INSUFFICIENT_SLUGS,
  BYOK_REQUIRED_SLUGS,
  TOOLROUTE_INTERNAL_SLUGS,
} from "./byok-required-slugs";

export type AdapterCatalogStatus = "available" | "coming_soon";
export type AdapterAccessMode = "pool" | "byok" | "free" | "unavailable";

export interface AdapterAvailability {
  adapter_slug: string | null;
  status: AdapterCatalogStatus;
  access_mode: AdapterAccessMode;
  pool_available: boolean;
  byok_required: boolean;
}

const REQUIRED_ENV_BY_ADAPTER: Record<string, string[]> = {
  apollo: ["APOLLO_API_KEY"],
  auto: ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"],
  calendar: [],
  claude: ["ANTHROPIC_API_KEY"],
  context7: [],
  creatify: ["CREATIFY_API_ID", "CREATIFY_API_KEY"],
  creatomate: ["CREATOMATE_API_KEY"],
  dataforseo: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  deepgram: ["DEEPGRAM_API_KEY"],
  drive: [],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  exa: ["EXA_API_KEY"],
  firecrawl: ["FIRECRAWL_API_KEY"],
  github: ["GITHUB_TOKEN"],
  heygen: ["HEYGEN_API_KEY"],
  higgsfield: ["HIGGSFIELD_API_KEY"],
  hubspot: ["HUBSPOT_ACCESS_TOKEN"],
  image: ["FAL_KEY"],
  linear: ["LINEAR_API_KEY"],
  linkedin: ["LINKEDIN_ACCESS_TOKEN"],
  mux: ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET"],
  notion: ["NOTION_API_KEY"],
  novita: ["NOVITA_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  outscraper: ["OUTSCRAPER_API_KEY"],
  pdf: ["HTML2PDF_API_KEY"],
  pexels: ["PEXELS_API_KEY"],
  playwright: [],
  postiz: ["POSTIZ_API_KEY"],
  removebg: ["REMOVEBG_API_KEY"],
  replicate: ["REPLICATE_API_TOKEN"],
  resend: ["RESEND_API_KEY"],
  screenshot: ["SCREENSHOTONE_API_KEY"],
  search: ["BRAVE_SEARCH_API_KEY"],
  sendgrid: ["SENDGRID_API_KEY"],
  sentry: ["SENTRY_AUTH_TOKEN"],
  sheets: [],
  shippo: ["SHIPPO_API_KEY"],
  shotstack: ["SHOTSTACK_API_KEY"],
  slack: ["SLACK_BOT_TOKEN"],
  stripe: ["STRIPE_PLATFORM_KEY"],
  supabase: ["SUPABASE_MGMT_TOKEN"],
  tavily: ["TAVILY_API_KEY"],
  textbelt: ["TEXTBELT_API_KEY"],
  toolroute: ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"],
  translate: ["DEEPL_API_KEY"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  twitter: ["TWITTER_BEARER_TOKEN"],
  unsplash: ["UNSPLASH_ACCESS_KEY"],
  vapi: ["VAPI_API_KEY"],
  whisper: ["OPENAI_API_KEY"],
  youtube: ["YOUTUBE_ACCESS_TOKEN"],
};

const TOOL_SLUG_ALIASES: Record<string, string> = {
  "brave-search": "search",
  "claude-api": "claude",
  deepl: "translate",
  "fal-ai": "image",
  "github-mcp": "github",
  "google-calendar": "calendar",
  "google-calendar-mcp": "calendar",
  "google-drive": "drive",
  "google-drive-mcp": "drive",
  "google-sheets": "sheets",
  "google-sheets-mcp": "sheets",
  "heygen-mcp": "heygen",
  "hicsfield-nano-banana": "higgsfield",
  html2pdf: "pdf",
  "hubspot-mcp": "hubspot",
  "linear-mcp": "linear",
  "notion-mcp": "notion",
  "playwright-mcp": "playwright",
  screenshotone: "screenshot",
  "sentry-mcp": "sentry",
  "slack-mcp": "slack",
  "stripe-mcp": "stripe",
  "supabase-mcp": "supabase",
  "twitter-x": "twitter",
  "youtube-api": "youtube",
};

export function listKnownAdapterSlugs() {
  return Object.keys(REQUIRED_ENV_BY_ADAPTER);
}

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

export function resolveAdapterSlug(toolSlug: string | null | undefined) {
  if (!toolSlug) return null;
  const normalized = toolSlug.toLowerCase();

  if (REQUIRED_ENV_BY_ADAPTER[normalized]) return normalized;
  if (TOOL_SLUG_ALIASES[normalized]) return TOOL_SLUG_ALIASES[normalized];

  const slashPrefix = normalized.split("/")[0];
  if (REQUIRED_ENV_BY_ADAPTER[slashPrefix]) return slashPrefix;

  return null;
}

export function getAdapterAvailability(adapterSlug: string): AdapterAvailability {
  const requiredEnv = REQUIRED_ENV_BY_ADAPTER[adapterSlug];
  const isByokRequired =
    BYOK_REQUIRED_SLUGS.has(adapterSlug) ||
    AMBIGUOUS_DEFAULT_BYOK_SLUGS.has(adapterSlug);
  const isUnavailable = BYOK_INSUFFICIENT_SLUGS.has(adapterSlug);
  const isInternal = TOOLROUTE_INTERNAL_SLUGS.has(adapterSlug);

  if (!requiredEnv) {
    return {
      adapter_slug: null,
      status: "coming_soon",
      access_mode: "unavailable",
      pool_available: false,
      byok_required: false,
    };
  }

  const missingEnv = requiredEnv.filter((name) => !hasEnv(name));
  const poolAvailable = missingEnv.length === 0;

  if (isUnavailable) {
    return {
      adapter_slug: adapterSlug,
      status: "coming_soon",
      access_mode: "unavailable",
      pool_available: poolAvailable,
      byok_required: true,
    };
  }

  if (isByokRequired) {
    return {
      adapter_slug: adapterSlug,
      status: "available",
      access_mode: "byok",
      pool_available: poolAvailable,
      byok_required: true,
    };
  }

  if (isInternal || requiredEnv.length === 0) {
    return {
      adapter_slug: adapterSlug,
      status: "available",
      access_mode: "free",
      pool_available: true,
      byok_required: false,
    };
  }

  return {
    adapter_slug: adapterSlug,
    status: poolAvailable ? "available" : "coming_soon",
    access_mode: poolAvailable ? "pool" : "unavailable",
    pool_available: poolAvailable,
    byok_required: false,
  };
}

export function getToolAvailability(
  toolSlug: string | null | undefined
): AdapterAvailability {
  const adapterSlug = resolveAdapterSlug(toolSlug);
  if (!adapterSlug) {
    return {
      adapter_slug: null,
      status: "coming_soon",
      access_mode: "unavailable",
      pool_available: false,
      byok_required: false,
    };
  }

  return getAdapterAvailability(adapterSlug);
}

export function listAvailableAdapters(adapters: ToolAdapter[]) {
  return adapters.filter(
    (adapter) => getAdapterAvailability(adapter.slug).status === "available"
  );
}
