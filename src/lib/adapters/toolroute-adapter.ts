import { createClient } from "@supabase/supabase-js";
import type { ToolAdapter, AdapterResult } from "../gateway-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const toolrouteAdapter: ToolAdapter = {
  slug: "toolroute",
  name: "ToolRoute",
  description:
    "Query the ToolRoute capability registry — check before building, search existing tools",
  operations: ["check_before_build", "search"],

  async execute(
    operation: string,
    input: Record<string, unknown>
  ): Promise<AdapterResult> {
    const start = Date.now();

    try {
      if (operation === "check_before_build") {
        const task = input.task as string;
        if (!task) {
          return {
            success: false,
            error: "Missing required field: task",
            provider: "toolroute",
          };
        }

        const { data, error } = await supabase.rpc("check_before_build", {
          p_task: task,
        });
        if (error) throw error;

        return { success: true, data, provider: "toolroute" };
      }

      if (operation === "search") {
        const query = input.query as string;
        const limit = (input.limit as number) ?? 10;
        if (!query) {
          return {
            success: false,
            error: "Missing required field: query",
            provider: "toolroute",
          };
        }

        const { data, error } = await supabase.rpc("search_tools_text", {
          p_query: query,
          p_limit: limit,
        });
        if (error) throw error;

        return { success: true, data, provider: "toolroute" };
      }

      return {
        success: false,
        error: `Unknown operation: ${operation}`,
        provider: "toolroute",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, provider: "toolroute" };
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      const { error } = await supabase
        .from("tools")
        .select("id")
        .limit(1)
        .single();
      return { healthy: !error, latency_ms: Date.now() - start };
    } catch {
      return { healthy: false, latency_ms: Date.now() - start };
    }
  },

  estimateCost(operation: string): number {
    if (operation === "check_before_build") return 0.001;
    if (operation === "search") return 0.0005;
    return 0.001;
  },
};
