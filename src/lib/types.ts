export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  rating: number;
  super_category: string;
  sub_category: string;
  protocols: string[];
  primary_type: string;
  capabilities: string[];
  cost: string;
  status: string;
  website_url?: string;
  docs_url?: string;
  mcp_package?: string;
  discovered_via?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  super_category: string;
  sub_category: string;
  display_name: string;
  description: string;
  tool_count: number;
  created_at: string;
}

export interface CategoryBelief {
  id: string;
  super_category: string;
  sub_category: string;
  champion: string;
  confidence: number;
  observation_count: number;
  reasoning: string;
  last_tested?: string;
  created_at: string;
  updated_at: string;
}

export interface Composite {
  id: string;
  name: string;
  slug: string;
  description: string;
  tool_slugs: string[];
  skill_template?: string;
  use_cases: string[];
  status: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  tool_slug: string;
  installed_location: string;
  config_path?: string;
  status: string;
  installed_at: string;
}

export interface UsageEvent {
  id: string;
  tool_slug: string;
  company: string;
  action: string;
  outcome: string;
  duration_ms?: number;
  created_at: string;
}

export interface LibrarianState {
  tool_count: number;
  belief_count: number;
  category_count: number;
  champion_count: number;
  composite_count: number;
  inventory_count: number;
  usage_events_7d: number;
  pending_discoveries: number;
  top_beliefs: CategoryBelief[];
  low_confidence: CategoryBelief[];
  recent_overrides: unknown[];
  pending_conversations: unknown[];
}

export interface CheckResult {
  matching_tools: Tool[];
  installed: InventoryItem[];
  beliefs: CategoryBelief[];
  composites: Composite[];
}

export const SUPER_CATEGORIES = [
  { key: "communication", label: "Communication & Messaging", icon: "MessageSquare" },
  { key: "crm_sales", label: "CRM & Sales", icon: "Target" },
  { key: "scheduling", label: "Scheduling & Calendar", icon: "Calendar" },
  { key: "analytics", label: "Analytics & Tracking", icon: "BarChart3" },
  { key: "ecommerce", label: "E-commerce & Inventory", icon: "ShoppingCart" },
  { key: "devops", label: "DevOps & CI/CD", icon: "GitBranch" },
  { key: "finance", label: "Finance & Invoicing", icon: "DollarSign" },
  { key: "content", label: "Content & Copywriting", icon: "PenTool" },
  { key: "marketing", label: "Marketing & Social Media", icon: "Megaphone" },
  { key: "operations", label: "HR & Operations", icon: "Settings" },
  { key: "security", label: "Security & Compliance", icon: "Shield" },
  { key: "infrastructure", label: "Infrastructure", icon: "Server" },
] as const;

export type SuperCategoryKey = (typeof SUPER_CATEGORIES)[number]["key"];
