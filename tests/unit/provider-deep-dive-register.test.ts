import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listKnownAdapterSlugs } from "@/lib/adapter-availability";

const REGISTER_PATH = resolve(
  process.cwd(),
  ".agent/provider-deep-dive-register.md"
);

const LAUNCH_CLASSES = new Set([
  "native",
  "customer_byok",
  "customer_oauth",
  "pool_contract_required",
  "unavailable",
]);

type RegisterRow = {
  adapter: string;
  launchClass: string;
  credentialOwner: string;
  setupPath: string;
  isolationDesign: string;
  evidenceSource: string;
  nextDeepDive: string;
};

function parseRegisterRows(markdown: string): RegisterRow[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        adapter: cells[0]?.replace(/`/g, "") ?? "",
        launchClass: cells[1] ?? "",
        credentialOwner: cells[2] ?? "",
        setupPath: cells[3] ?? "",
        isolationDesign: cells[4] ?? "",
        evidenceSource: cells[5] ?? "",
        nextDeepDive: cells[6] ?? "",
      };
    });
}

describe("provider deep-dive register", () => {
  const markdown = readFileSync(REGISTER_PATH, "utf8");
  const rows = parseRegisterRows(markdown);

  it("defines the ToolRoute one-key isolation model and definition of good", () => {
    expect(markdown).toContain("## Agent Isolation Model");
    expect(markdown).toContain("## Definition Of Good");
    expect(markdown).toContain("gateway_users.id");
    expect(markdown).toContain("api_keys.user_id");
    expect(markdown).toContain("user_provider_keys.user_id + tool_slug");
  });

  it("has exactly one row for every known adapter slug", () => {
    const expected = listKnownAdapterSlugs().sort();
    const actual = rows.map((row) => row.adapter).sort();

    expect(actual).toEqual(expected);
  });

  it("uses only known launch classes", () => {
    const invalid = rows.filter((row) => !LAUNCH_CLASSES.has(row.launchClass));

    expect(invalid).toEqual([]);
  });

  it("keeps setup paths consistent with the launch class", () => {
    const errors: string[] = [];
    for (const row of rows) {
      if (row.launchClass === "customer_byok" && !row.setupPath.includes("/api/v1/byok")) {
        errors.push(`${row.adapter}: BYOK row missing /api/v1/byok`);
      }
      if (row.launchClass === "customer_oauth" && !row.setupPath.toLowerCase().includes("oauth")) {
        errors.push(`${row.adapter}: OAuth row missing OAuth setup path`);
      }
      if (row.launchClass === "native" && row.setupPath !== "none") {
        errors.push(`${row.adapter}: native row should require no setup`);
      }
      if (!row.isolationDesign) {
        errors.push(`${row.adapter}: missing isolation design`);
      }
      if (!row.evidenceSource) {
        errors.push(`${row.adapter}: missing evidence source`);
      }
      if (!row.nextDeepDive) {
        errors.push(`${row.adapter}: missing next deep dive`);
      }
    }

    expect(errors).toEqual([]);
  });
});
