import type { ToolAdapter } from "../gateway-types";
import { toolrouteAdapter } from "./toolroute-adapter";
import { context7Adapter } from "./context7-adapter";
import { firecrawlAdapter } from "./firecrawl-adapter";
import { elevenlabsAdapter } from "./elevenlabs-adapter";
import { sendgridAdapter } from "./sendgrid-adapter";
import { playwrightAdapter } from "./playwright-adapter";
import { claudeAdapter } from "./claude-adapter";
import { githubAdapter } from "./github-adapter";
import { supabaseAdapter } from "./supabase-adapter";
import { stripeAdapter } from "./stripe-adapter";
import { twilioAdapter } from "./twilio-adapter";
import { whisperAdapter } from "./whisper-adapter";
import { resendAdapter } from "./resend-adapter";
import { searchAdapter } from "./search-adapter";
import { imageGenAdapter } from "./image-gen-adapter";
import { deeplAdapter } from "./deepl-adapter";
import { screenshotAdapter } from "./screenshot-adapter";
import { pdfAdapter } from "./pdf-adapter";
import { calendarAdapter } from "./calendar-adapter";
import { driveAdapter } from "./drive-adapter";
import { openaiAdapter } from "./openai-adapter";
import { pexelsAdapter } from "./pexels-adapter";
import { unsplashAdapter } from "./unsplash-adapter";
import { removebgAdapter } from "./removebg-adapter";
import { vapiAdapter } from "./vapi-adapter";
import { creatifyAdapter } from "./creatify-adapter";
import { apolloAdapter } from "./apollo-adapter";
import { shippoAdapter } from "./shippo-adapter";
import { replicateAdapter } from "./replicate-adapter";
import { sentryAdapter } from "./sentry-adapter";
import { outscraperAdapter } from "./outscraper-adapter";
import { textbeltAdapter } from "./textbelt-adapter";
import { deepgramAdapter } from "./deepgram-adapter";
import { heygenAdapter } from "./heygen-adapter";
import { muxAdapter } from "./mux-adapter";
import { dataforseoAdapter } from "./dataforseo-adapter";
import { postizAdapter } from "./postiz-adapter";
import { creatomateAdapter } from "./creatomate-adapter";
import { shotstackAdapter } from "./shotstack-adapter";
import { higgsFieldAdapter } from "./higgsfield-adapter";
import { exaAdapter } from "./exa-adapter";
import { tavilyAdapter } from "./tavily-adapter";
import { twitterAdapter } from "./twitter-adapter";
import { linkedinAdapter } from "./linkedin-adapter";
import { youtubeAdapter } from "./youtube-adapter";
import { slackAdapter } from "./slack-adapter";
import { autoAdapter } from "./auto-adapter";

const registry = new Map<string, ToolAdapter>();

export function registerAdapter(adapter: ToolAdapter): void {
  registry.set(adapter.slug, adapter);
}

export function getAdapter(toolSlug: string): ToolAdapter | null {
  const directMatch = registry.get(toolSlug);
  if (directMatch) return directMatch;

  for (const [slug, adapter] of registry) {
    if (toolSlug.startsWith(slug + "/")) return adapter;
  }

  return null;
}

export function listAdapters(): ToolAdapter[] {
  return Array.from(registry.values());
}

registerAdapter(toolrouteAdapter);
registerAdapter(context7Adapter);
registerAdapter(firecrawlAdapter);
registerAdapter(elevenlabsAdapter);
registerAdapter(sendgridAdapter);
registerAdapter(playwrightAdapter);
registerAdapter(claudeAdapter);
registerAdapter(githubAdapter);
registerAdapter(supabaseAdapter);
registerAdapter(stripeAdapter);
registerAdapter(twilioAdapter);
registerAdapter(whisperAdapter);
registerAdapter(resendAdapter);
registerAdapter(searchAdapter);
registerAdapter(imageGenAdapter);
registerAdapter(deeplAdapter);
registerAdapter(screenshotAdapter);
registerAdapter(pdfAdapter);
registerAdapter(calendarAdapter);
registerAdapter(driveAdapter);
registerAdapter(openaiAdapter);
registerAdapter(pexelsAdapter);
registerAdapter(unsplashAdapter);
registerAdapter(removebgAdapter);
registerAdapter(vapiAdapter);
registerAdapter(creatifyAdapter);
registerAdapter(apolloAdapter);
registerAdapter(shippoAdapter);
registerAdapter(replicateAdapter);
registerAdapter(sentryAdapter);
registerAdapter(outscraperAdapter);
registerAdapter(textbeltAdapter);
registerAdapter(deepgramAdapter);
registerAdapter(heygenAdapter);
registerAdapter(muxAdapter);
registerAdapter(dataforseoAdapter);
registerAdapter(postizAdapter);
registerAdapter(creatomateAdapter);
registerAdapter(shotstackAdapter);
registerAdapter(higgsFieldAdapter);
registerAdapter(exaAdapter);
registerAdapter(tavilyAdapter);
registerAdapter(twitterAdapter);
registerAdapter(linkedinAdapter);
registerAdapter(youtubeAdapter);
registerAdapter(slackAdapter);

// Auto adapter MUST be registered last so it can discover all other adapters
registerAdapter(autoAdapter);
