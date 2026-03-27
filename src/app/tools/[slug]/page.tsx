import { getToolBySlug, getBeliefs, getInventory } from "@/lib/api";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, CheckCircle } from "lucide-react";
import Link from "next/link";

export const revalidate = 60;

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [tool, beliefs, inventory] = await Promise.all([
    getToolBySlug(slug),
    getBeliefs(),
    getInventory(),
  ]);

  if (!tool) notFound();

  const belief = beliefs.find(
    (b) =>
      b.champion.toLowerCase() === tool.name.toLowerCase() ||
      b.sub_category === tool.sub_category
  );
  const installed = inventory.find((i) => i.tool_slug === tool.slug);

  const ratingColor =
    tool.rating >= 10
      ? "text-green"
      : tool.rating >= 9
        ? "text-accent"
        : "text-amber";

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/tools"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Registry
      </Link>

      <div className="border border-border rounded-lg p-6 bg-bg-card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">{tool.name}</h1>
            <p className="text-xs text-text-muted">
              {tool.super_category} / {tool.sub_category.replace(/_/g, " ")}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${ratingColor}`}>
              {tool.rating}/10
            </span>
            {installed && (
              <div className="flex items-center gap-1 text-green text-xs mt-1">
                <CheckCircle className="w-3 h-3" />
                Installed
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-text-dim mb-4">{tool.description}</p>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-text-muted mb-1">Protocols</p>
            <div className="flex gap-1.5 flex-wrap">
              {tool.protocols?.map((p) => (
                <span key={p} className="protocol-badge">
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-text-muted mb-1">Type</p>
            <p className="text-text">{tool.primary_type?.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">Cost</p>
            <p className="text-text capitalize">{tool.cost}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">Status</p>
            <p className="text-text capitalize">{tool.status}</p>
          </div>
        </div>

        {tool.capabilities && tool.capabilities.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-text-muted mb-1.5">Capabilities</p>
            <div className="flex gap-1.5 flex-wrap">
              {tool.capabilities.map((c) => (
                <span
                  key={c}
                  className="text-[10px] bg-bg-surface border border-border rounded px-2 py-0.5 text-text-dim"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-5 pt-4 border-t border-border">
          {tool.website_url && (
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Website <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {tool.docs_url && (
            <a
              href={tool.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Docs <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Belief */}
      {belief && (
        <div className="border border-border rounded-lg p-4 bg-bg-card mb-6">
          <h2 className="text-sm font-semibold mb-3">Category Belief</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim">
              Champion of{" "}
              <span className="text-text">
                {belief.sub_category.replace(/_/g, " ")}
              </span>
            </span>
            <span className="text-xs font-mono text-accent">
              {Math.round(belief.confidence * 100)}% confidence
            </span>
          </div>
          <div className="w-full bg-bg-surface rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                belief.confidence >= 0.8 ? "bg-green" : "bg-accent"
              }`}
              style={{ width: `${belief.confidence * 100}%` }}
            />
          </div>
          {belief.reasoning && (
            <p className="text-xs text-text-dim mt-2">{belief.reasoning}</p>
          )}
          <p className="text-[10px] text-text-muted mt-1">
            {belief.observation_count} observations
          </p>
        </div>
      )}

      {/* Installed info */}
      {installed && (
        <div className="border border-green/20 rounded-lg p-4 bg-green/5">
          <h2 className="text-sm font-semibold text-green mb-2">
            Installed in Fleet
          </h2>
          <div className="text-xs text-text-dim space-y-1">
            <p>
              <span className="text-text-muted">Location:</span>{" "}
              {installed.installed_location}
            </p>
            {installed.config_path && (
              <p>
                <span className="text-text-muted">Config:</span>{" "}
                {installed.config_path}
              </p>
            )}
            <p>
              <span className="text-text-muted">Status:</span>{" "}
              <span className="capitalize">{installed.status}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
