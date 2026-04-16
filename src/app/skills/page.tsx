import type { Metadata } from "next";
import { getSkills } from "@/lib/api";
import type { Skill } from "@/lib/types";
import Link from "next/link";
import {
  Sparkles,
  ExternalLink,
  BookOpen,
  Terminal,
  Cpu,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Agent Skills — 40+ Installable Procedures | ToolRoute",
  description:
    "Browse 40+ AI agent skills your agent can install locally. Procedures for design, development, security, and more. No API calls needed.",
  alternates: {
    canonical: "/skills",
  },
  openGraph: {
    title: "AI Agent Skills — 40+ Installable Procedures | ToolRoute",
    description: "Browse 40+ AI agent skills your agent can install locally. Procedures for design, development, security, and more.",
    url: "https://toolroute.ai/skills",
  },
};

export const revalidate = 300;

const SKILL_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "design", label: "Design" },
  { key: "development", label: "Development" },
  { key: "content", label: "Content" },
  { key: "productivity", label: "Productivity" },
  { key: "devops", label: "DevOps" },
  { key: "meta", label: "Meta" },
  { key: "testing", label: "Testing" },
  { key: "security", label: "Security" },
  { key: "marketing", label: "Marketing" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "communication", label: "Communication" },
  { key: "finance", label: "Finance" },
];

function SourceBadge({ type }: { type: string }) {
  if (type === "official") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent">
        Official
      </span>
    );
  }
  if (type === "community") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-green/10 border border-green/30 text-green">
        Community
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
      Generic
    </span>
  );
}

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category || "all";

  let skills: Skill[];
  try {
    skills = await getSkills();
  } catch {
    skills = [];
  }

  const filtered =
    activeCategory === "all"
      ? skills
      : skills.filter((s) => s.category === activeCategory);

  const categoryCounts: Record<string, number> = { all: skills.length };
  for (const s of skills) {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
  }

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI Agent Skills — Installable Procedures",
    description:
      "Browse 40+ AI agent skills your agent can install locally. Procedures for design, development, security, and more. No API calls needed.",
    url: "https://toolroute.ai/skills",
    isPartOf: {
      "@type": "WebSite",
      name: "ToolRoute",
      url: "https://toolroute.ai",
    },
    mainEntity: {
      "@type": "ItemList",
      name: "ToolRoute Skills",
      description:
        "Curated agent skills — procedures you install into your agent's context, not APIs you call.",
      numberOfItems: skills.length,
      itemListElement: skills.slice(0, 25).map((skill, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: skill.name,
        url: skill.source_url || "https://toolroute.ai/skills",
      })),
    },
  };

  return (
    <div className="space-y-12 pb-16 animate-slide-up">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      {/* Hero */}
      <section className="text-center pt-8 pb-2">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-accent font-medium">
            Skills Directory
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 leading-[1.1]">
          Agent <span className="text-accent">Skills</span>
        </h1>
        <p className="text-text-dim max-w-2xl mx-auto text-sm leading-relaxed">
          Discover procedures and best practices for your agent. Skills are code
          you install into your agent&apos;s context — not APIs you call. They
          teach your agent new capabilities it runs locally.
        </p>
      </section>

      {/* Category Filter Bar */}
      <section>
        <div className="flex flex-wrap items-center gap-2 justify-center">
          {SKILL_CATEGORIES.filter(
            (c) => c.key === "all" || (categoryCounts[c.key] ?? 0) > 0
          ).map((cat) => (
            <Link
              key={cat.key}
              href={
                cat.key === "all" ? "/skills" : `/skills?category=${cat.key}`
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                activeCategory === cat.key
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-bg-card border border-border text-text-dim hover:text-text hover:border-accent/30"
              }`}
            >
              {cat.label}
              <span className="text-[10px] text-text-muted">
                {categoryCounts[cat.key] ?? 0}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Skills Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-text-muted">
            {filtered.length} skill{filtered.length !== 1 ? "s" : ""}
            {activeCategory !== "all" && (
              <>
                {" "}
                in <span className="text-text-dim">{activeCategory}</span>
              </>
            )}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No skills found in this category.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((skill) => (
              <div
                key={skill.id}
                className="border border-border rounded-lg p-5 bg-bg-card hover:bg-bg-card-hover hover:border-accent/30 transition-all group flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm group-hover:text-accent transition-colors leading-snug">
                    {skill.name}
                  </h3>
                  <SourceBadge type={skill.source_type} />
                </div>

                {/* Description */}
                <p className="text-xs text-text-dim line-clamp-2 mb-3 leading-relaxed flex-1">
                  {skill.description}
                </p>

                {/* Category tag */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-bg-surface border border-border text-text-muted uppercase tracking-wider">
                    {skill.category}
                  </span>
                  {skill.tags?.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-bg-surface text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Install command + link */}
                <div className="mt-auto pt-3 border-t border-border/50 space-y-2">
                  {skill.source_url ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-text-muted shrink-0" />
                        <code className="text-[10px] text-accent bg-bg-surface px-2 py-1 rounded truncate flex-1">
                          npx @anthropic-ai/claude-code skills add{" "}
                          {skill.source_url
                            .replace("https://github.com/", "")
                            .replace("/tree/main/", "/")}
                        </code>
                      </div>
                      <a
                        href={skill.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-text-dim hover:text-accent transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View source
                      </a>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-text-muted shrink-0" />
                      <span className="text-[10px] text-text-muted">
                        Procedure-based skill
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How Skills Work */}
      <section className="border border-border rounded-lg bg-bg-card p-8">
        <h2 className="text-lg font-bold mb-6 text-center">
          How Skills Work
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold text-xs mb-2">SKILL.md Files</h3>
            <p className="text-xs text-text-dim leading-relaxed">
              Skills are SKILL.md files that teach your agent new procedures.
              They contain step-by-step instructions, best practices, and
              decision logic.
            </p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center mx-auto mb-3">
              <Cpu className="w-5 h-5 text-green" />
            </div>
            <h3 className="font-semibold text-xs mb-2">Local Execution</h3>
            <p className="text-xs text-text-dim leading-relaxed">
              Unlike ToolRoute tools (which execute remotely via API), skills run
              entirely in your agent&apos;s local context. No API calls, no
              latency, no cost per use.
            </p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center mx-auto mb-3">
              <Terminal className="w-5 h-5 text-purple" />
            </div>
            <h3 className="font-semibold text-xs mb-2">Easy Install</h3>
            <p className="text-xs text-text-dim leading-relaxed">
              Install any skill with a single command in Claude Code. Skills from
              GitHub repos can be added with{" "}
              <code className="text-[10px] bg-bg-surface px-1 py-0.5 rounded text-accent">
                npx @anthropic-ai/claude-code skills add author/repo
              </code>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
          >
            Looking for remote API tools instead?
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
