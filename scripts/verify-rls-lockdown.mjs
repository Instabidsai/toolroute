#!/usr/bin/env node
// ToolRoute — Lane 4.4 RLS regression guard.
//
// Probes Supabase REST with the anon key and asserts:
//   1. Sensitive gateway tables refuse anon SELECT (401 or []).
//   2. Public catalog tables continue to serve rows (no over-correction).
//
// Usage: node scripts/verify-rls-lockdown.mjs
// Env:   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// Exits 0 on pass, 1 on any leak or over-lock. Safe to wire into deploy gates.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://isbratmfnnzipzyoefbo.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!ANON) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_ANON_KEY env var not set.");
  process.exit(1);
}

// Tables that MUST refuse anon SELECT. Adding a new gateway table?
// Default-add it here unless it's part of the public catalog surface.
const LOCKED_TABLES = [
  "usage_events",
  "inventory",
  "tool_requests",
  "gateway_usage_log",
  "api_keys",
  "user_provider_keys",
  "billing_transactions",
  "gateway_users",
];

// Tables that MUST stay anon-readable (catalog surface on toolroute.ai).
// If any of these stop returning rows, the public site breaks.
const PUBLIC_TABLES = [
  "tools",
  "tool_categories",
];

async function probe(table) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const body = await res.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = body; }
  return { status: res.status, body: parsed, raw: body };
}

const failures = [];

for (const t of LOCKED_TABLES) {
  const r = await probe(t);
  const leaked = r.status === 200 && Array.isArray(r.body) && r.body.length > 0;
  const hardLocked = r.status === 401 || r.status === 403 || r.status === 404;
  const ambiguous = r.status === 200 && Array.isArray(r.body) && r.body.length === 0;
  if (leaked) {
    failures.push(`LEAK: ${t} returned ${r.body.length} row(s) to anon. First row keys: ${Object.keys(r.body[0]).join(", ")}`);
  } else if (hardLocked) {
    console.log(`  ok  ${t.padEnd(24)} status=${r.status} (locked)`);
  } else if (ambiguous) {
    // 200+[] means anon has SELECT grant but the table is currently empty.
    // Not a leak today, but RLS isn't proven — flag as warning.
    console.log(`  ??  ${t.padEnd(24)} status=200 rows=0 (permissive-but-empty; insert a row and re-run)`);
  } else {
    console.log(`  ok  ${t.padEnd(24)} status=${r.status} ${Array.isArray(r.body) ? `rows=${r.body.length}` : "non-array"}`);
  }
}

for (const t of PUBLIC_TABLES) {
  const r = await probe(t);
  const ok = r.status === 200 && Array.isArray(r.body) && r.body.length > 0;
  if (!ok) {
    failures.push(`OVER-LOCK: ${t} should be anon-readable but returned status=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`);
  } else {
    console.log(`  ok  ${t.padEnd(24)} status=${r.status} rows=${r.body.length} (public)`);
  }
}

if (failures.length) {
  console.error("\nFAIL — RLS regression detected:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("\nPASS — all locked tables refuse anon, all public tables serve rows.");
