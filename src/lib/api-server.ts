import "server-only";
import { supabaseAdmin } from "./supabase-server";
import type { InventoryItem, UsageEvent } from "./types";

// Sensitive-table reads that must run with the service-role client.
// After Lane 4.5 lockdown SQL, anon SELECT is revoked on `inventory` and
// `usage_events` — calling these via the public client returns [] and the
// server-rendered page silently shows zero rows. Always import these from
// a server component (the `import "server-only"` above will fail the build
// if a "use client" component imports this module).

export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabaseAdmin.from("inventory").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getUsageEvents(limit = 50): Promise<UsageEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
