#!/usr/bin/env node
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");

function copyIfPresent(source, target) {
  if (existsSync(source)) {
    cpSync(source, target, { recursive: true, force: true });
  }
}

const envFile = process.env.TOOLROUTE_E2E_ENV_FILE || join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    const [, key, rawValue] = match;
    process.env[key] ??= rawValue.trim().replace(/^['"]|['"]$/g, "");
  }
}

copyIfPresent(join(root, ".next", "static"), join(standaloneRoot, ".next", "static"));
copyIfPresent(join(root, "public"), join(standaloneRoot, "public"));

process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3014";

await import("../.next/standalone/server.js");
