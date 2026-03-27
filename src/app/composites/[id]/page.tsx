import { getComposites, getTools } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";

export const revalidate = 60;

export default async function CompositeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [composites, tools] = await Promise.all([
    getComposites(),
    getTools(),
  ]);

  const composite = composites.find((c) => c.id === id);
  if (!composite) notFound();

  const toolMap = new Map(tools.map((t) => [t.slug, t]));
  const chainTools = composite.tool_slugs
    ?.map((s) => toolMap.get(s))
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/composites"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Composites
      </Link>

      <div className="border border-border rounded-lg p-6 bg-bg-card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{composite.name}</h1>
            <p className="text-xs text-text-muted capitalize">
              {composite.status}
            </p>
          </div>
        </div>

        <p className="text-sm text-text-dim mb-4">{composite.description}</p>

        {composite.use_cases && composite.use_cases.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-1.5">Use Cases</p>
            <div className="flex flex-wrap gap-1.5">
              {composite.use_cases.map((uc) => (
                <span
                  key={uc}
                  className="text-[11px] bg-bg-surface border border-border rounded px-2 py-0.5 text-text-dim"
                >
                  {uc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tool Chain */}
      <h2 className="text-sm font-semibold mb-3">
        Tool Chain ({chainTools?.length || 0} tools)
      </h2>
      <div className="space-y-3 mb-6">
        {chainTools?.map((tool, i) =>
          tool ? (
            <div key={tool.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                  {i + 1}
                </div>
                {i < (chainTools.length || 0) - 1 && (
                  <div className="w-px h-8 bg-border mt-1" />
                )}
              </div>
              <div className="flex-1">
                <ToolCard tool={tool} />
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* Skill Template */}
      {composite.skill_template && (
        <div className="border border-border rounded-lg p-4 bg-bg-card">
          <h2 className="text-sm font-semibold mb-3">Skill Template</h2>
          <pre className="text-xs text-text-dim overflow-auto max-h-96 whitespace-pre-wrap">
            {composite.skill_template}
          </pre>
        </div>
      )}
    </div>
  );
}
