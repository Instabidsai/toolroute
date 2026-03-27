import {
  getToolsByCategory,
  getBeliefsByCategory,
  getCategories,
} from "@/lib/api";
import { SUPER_CATEGORIES } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { BeliefBar } from "@/components/BeliefBar";

export const revalidate = 60;

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ super: string }>;
}) {
  const { super: superCat } = await params;
  const sc = SUPER_CATEGORIES.find((c) => c.key === superCat);
  if (!sc) notFound();

  const [tools, beliefs, categories] = await Promise.all([
    getToolsByCategory(superCat),
    getBeliefsByCategory(superCat),
    getCategories(),
  ]);

  const subs = categories.filter((c) => c.super_category === superCat);

  return (
    <div>
      <Link
        href="/categories"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Categories
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">{sc.label}</h1>
        <p className="text-sm text-text-dim">
          {subs.length} sub-categories &middot; {tools.length} tools &middot;{" "}
          {beliefs.length} beliefs
        </p>
      </div>

      {/* Beliefs */}
      {beliefs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Champion Beliefs</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {beliefs.map((b) => (
              <BeliefBar key={b.id} belief={b} />
            ))}
          </div>
        </section>
      )}

      {/* Sub-categories */}
      {subs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Sub-Categories</h2>
          <div className="flex flex-wrap gap-2">
            {subs.map((s) => (
              <span
                key={s.id}
                className="text-xs bg-bg-card border border-border rounded px-3 py-1.5 text-text-dim"
              >
                {s.display_name || s.sub_category.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Tools */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Tools ({tools.length})
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
        {tools.length === 0 && (
          <p className="text-sm text-text-dim py-8 text-center">
            No tools in this category yet.
          </p>
        )}
      </section>
    </div>
  );
}
