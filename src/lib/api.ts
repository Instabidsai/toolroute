import { supabase } from "./supabase";
import type {
  Tool,
  Category,
  CategoryBelief,
  Composite,
  InventoryItem,
  UsageEvent,
  LibrarianState,
} from "./types";

export async function getTools(): Promise<Tool[]> {
  const { data, error } = await supabase
    .from("tools")
    .select("*")
    .order("rating", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getToolBySlug(slug: string): Promise<Tool | null> {
  const { data, error } = await supabase
    .from("tools")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("tool_categories")
    .select("*")
    .order("super_category")
    .order("sub_category");
  if (error) throw error;
  return data ?? [];
}

export async function getBeliefs(): Promise<CategoryBelief[]> {
  const { data, error } = await supabase
    .from("category_beliefs")
    .select("*")
    .order("confidence", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getComposites(): Promise<Composite[]> {
  const { data, error } = await supabase
    .from("composites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from("inventory").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getUsageEvents(limit = 50): Promise<UsageEvent[]> {
  const { data, error } = await supabase
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function checkBeforeBuild(task: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("check_before_build", {
    p_task: task,
  });
  if (error) throw error;
  return data;
}

export async function searchTools(query: string, limit = 10): Promise<Tool[]> {
  const { data, error } = await supabase.rpc("search_tools_text", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getLibrarianState(): Promise<LibrarianState> {
  const { data, error } = await supabase.rpc("librarian_startup");
  if (error) throw error;
  return data as LibrarianState;
}

export async function getCategoryChampion(
  superCat: string,
  subCat: string
): Promise<unknown> {
  const { data, error } = await supabase.rpc("get_category_champion", {
    p_super: superCat,
    p_sub: subCat,
  });
  if (error) throw error;
  return data;
}

export async function getToolsByCategory(
  superCategory: string
): Promise<Tool[]> {
  const { data, error } = await supabase
    .from("tools")
    .select("*")
    .eq("super_category", superCategory)
    .order("rating", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBeliefsByCategory(
  superCategory: string
): Promise<CategoryBelief[]> {
  const { data, error } = await supabase
    .from("category_beliefs")
    .select("*")
    .eq("super_category", superCategory)
    .order("confidence", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
