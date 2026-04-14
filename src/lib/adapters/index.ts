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

// Auto adapter MUST be registered last so it can discover all other adapters
registerAdapter(autoAdapter);
