import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Lane 4.120 — tasks/get and tasks/cancel in src/app/api/a2a/route.ts MUST
// each enforce (a) API-key auth (Bearer tr_live_) and (b) ownership match
// (task.userId === ctx.userId) before returning or mutating a stored task.
//
// Lane 4.89 audited this gap (Apr 28). The implementation never landed despite
// task #107 being marked completed. This drift guard fails if the next refactor
// drops either gate from either method handler.
//
// Detection: read route.ts as source, slice each `case "tasks/X":` block, and
// assert both an `Authorization` / `Bearer tr_live_` substring AND a
// `task.userId !== <ctx>.userId` substring exist inside that block. Also
// assert tasks/send no longer reads `params.id` (server-assigned only).

const ROUTE_PATH = join(process.cwd(), "src", "app", "api", "a2a", "route.ts");

function sliceCase(source: string, caseLabel: string): string {
  const startIdx = source.indexOf(`case "${caseLabel}":`);
  if (startIdx < 0) {
    throw new Error(`case "${caseLabel}": not found in a2a/route.ts`);
  }
  let depth = 0;
  let i = source.indexOf("{", startIdx);
  if (i < 0) throw new Error(`opening { not found after case "${caseLabel}":`);
  const start = i;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated case body for "${caseLabel}"`);
}

describe("A2A tasks/get + tasks/cancel auth + ownership (Lane 4.89 + 4.120)", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");

  it("tasks/get requires Bearer tr_live_ AND ownership match", () => {
    const block = sliceCase(source, "tasks/get");
    expect(
      /authorization/i.test(block),
      "tasks/get missing Authorization header read"
    ).toBe(true);
    expect(
      /Bearer tr_live_/.test(block),
      "tasks/get missing Bearer tr_live_ check"
    ).toBe(true);
    expect(
      /\.userId\s*!==\s*\w+\.userId/.test(block),
      "tasks/get missing ownership check (task.userId !== ctx.userId)"
    ).toBe(true);
  });

  it("tasks/cancel requires Bearer tr_live_ AND ownership match", () => {
    const block = sliceCase(source, "tasks/cancel");
    expect(
      /authorization/i.test(block),
      "tasks/cancel missing Authorization header read"
    ).toBe(true);
    expect(
      /Bearer tr_live_/.test(block),
      "tasks/cancel missing Bearer tr_live_ check"
    ).toBe(true);
    expect(
      /\.userId\s*!==\s*\w+\.userId/.test(block),
      "tasks/cancel missing ownership check (task.userId !== ctx.userId)"
    ).toBe(true);
  });

  it("tasks/send ignores customer-supplied params.id (server-assigned only)", () => {
    const block = sliceCase(source, "tasks/send");
    // params.id is the predictable-ID attack surface from Lane 4.89 §1.
    // Server must always generate task_<random>.
    expect(
      /params\?\.id/.test(block),
      "tasks/send still references params?.id — predictable-ID attack surface"
    ).toBe(false);
    expect(
      /task_\$\{randomBytes/.test(block),
      "tasks/send must server-assign task_id via randomBytes"
    ).toBe(true);
  });

  it("stored task type carries userId", () => {
    // Map<string, { ... userId: string ... }> declaration.
    expect(
      /userId:\s*string/.test(source),
      "taskStore Map value type missing userId: string field"
    ).toBe(true);
  });
});
