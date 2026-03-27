import { getComposites, getTools } from "@/lib/api";
import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function CompositesPage() {
  const [composites, tools] = await Promise.all([
    getComposites(),
    getTools(),
  ]);

  const toolMap = new Map(tools.map((t) => [t.slug, t]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Composites</h1>
        <p className="text-sm text-text-dim">
          Multi-tool solutions assembled from the registry. Each composite
          chains tools together for end-to-end workflows.
        </p>
      </div>

      <div className="grid gap-4">
        {composites.map((comp) => (
          <Link
            key={comp.id}
            href={`/composites/${comp.id}`}
            className="border border-border rounded-lg p-5 bg-bg-card hover:bg-bg-card-hover hover:border-border-bright transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-5 h-5 text-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold group-hover:text-accent transition-colors">
                    {comp.name}
                  </h2>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                </div>
                <p className="text-xs text-text-dim mb-3">
                  {comp.description}
                </p>

                {/* Tool chain */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {comp.tool_slugs?.map((slug, i) => {
                    const tool = toolMap.get(slug);
                    return (
                      <span key={slug} className="flex items-center gap-1.5">
                        <span className="text-[10px] bg-bg-surface border border-border rounded px-2 py-0.5 text-text-dim">
                          {tool?.name || slug}
                        </span>
                        {i < comp.tool_slugs.length - 1 && (
                          <span className="text-text-muted text-[10px]">
                            &rarr;
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* Use cases */}
                {comp.use_cases && comp.use_cases.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {comp.use_cases.map((uc) => (
                      <span
                        key={uc}
                        className="text-[9px] text-text-muted bg-bg-surface rounded px-1.5 py-0.5"
                      >
                        {uc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {composites.length === 0 && (
        <div className="text-center py-16 text-text-dim text-sm">
          No composites built yet.
        </div>
      )}
    </div>
  );
}
