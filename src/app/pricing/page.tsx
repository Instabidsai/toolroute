import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  Zap,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MCP Gateway Pricing — Free, Pro & Enterprise Plans | ToolRoute",
  description:
    "Transparent MCP gateway pricing from $0/mo. One API key for 70+ tools. Start free, scale with prepaid credits and BYOK support.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "MCP Gateway Pricing — Free, Pro & Enterprise Plans | ToolRoute",
    description: "Transparent MCP gateway pricing from $0/mo. One API key for 70+ tools with prepaid credits.",
    url: "https://toolroute.ai/pricing",
  },
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Get started and explore the platform.",
    cta: "Get Started Free",
    ctaHref: "/login",
    highlighted: false,
    features: [
      "100 requests/day",
      "10 RPM rate limit",
      "2 API keys",
      "Basic tools access",
      "Community support",
      "$1 starter credits",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For production workloads and serious builders.",
    cta: "Start Pro Trial",
    ctaHref: "/login",
    highlighted: true,
    features: [
      "10,000 requests/month",
      "60 RPM rate limit",
      "10 API keys",
      "All tools access",
      "Priority routing",
      "BYOK support",
      "Usage analytics",
      "Email support",
      "$5/mo included credits",
    ],
  },
  {
    name: "Enterprise",
    price: "$299",
    period: "/mo",
    description: "For teams that need scale, control, and SLAs.",
    cta: "Contact Sales",
    ctaHref: "/login",
    highlighted: false,
    features: [
      "100,000 requests/month",
      "300 RPM rate limit",
      "50 API keys",
      "All tools + custom adapters",
      "Priority routing",
      "BYOK support",
      "Dedicated support + SLA",
      "$50/mo included credits",
    ],
  },
] as const;

const faqs = [
  {
    q: "How does billing work?",
    a: "Prepaid credits. Buy credits, each tool call costs a small amount based on the underlying provider. Your plan includes monthly credits that refresh on your billing date.",
  },
  {
    q: "What if I run out of credits?",
    a: "Requests return a 402 Payment Required response. Top up instantly from your dashboard or enable auto-top-up to never hit a wall.",
  },
  {
    q: "Can I use my own API keys?",
    a: "Yes! BYOK (Bring Your Own Key) is supported on Pro and Enterprise plans. Register your own API keys for any tool and pay zero markup on those calls.",
  },
  {
    q: "How is this different from using tools directly?",
    a: "One key, one bill, automatic routing and fallbacks. Plus our intelligence layer picks the best tool for your task based on real usage data across hundreds of agents. No more managing 20 different API keys and accounts.",
  },
  {
    q: "Can I switch plans anytime?",
    a: "Yes. Upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the end of your billing period. Unused credits roll over for 30 days.",
  },
  {
    q: "Is there a rate limit on the Free plan?",
    a: "Free gets 10 requests per minute and 100 per day. This is enough for development and testing. Pro and Enterprise get much higher limits for production use.",
  },
] as const;

const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ToolRoute",
  description:
    "MCP gateway and unified API for 70+ AI tools. One API key, every tool. Prepaid credits + BYOK support.",
  brand: {
    "@type": "Brand",
    name: "ToolRoute",
  },
  url: "https://toolroute.ai/pricing",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      description:
        "Get started and explore the platform. 100 requests/day, 10 RPM, 2 API keys, $1 starter credits.",
      price: "0",
      priceCurrency: "USD",
      url: "https://toolroute.ai/pricing",
      availability: "https://schema.org/InStock",
      category: "Free",
    },
    {
      "@type": "Offer",
      name: "Pro",
      description:
        "For production workloads and serious builders. 10,000 requests/month, 60 RPM, 10 API keys, BYOK, $5/mo included credits.",
      price: "29",
      priceCurrency: "USD",
      url: "https://toolroute.ai/pricing",
      availability: "https://schema.org/InStock",
      category: "Subscription",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "29",
        priceCurrency: "USD",
        unitText: "MONTH",
        billingIncrement: 1,
      },
    },
    {
      "@type": "Offer",
      name: "Enterprise",
      description:
        "For teams that need scale, control, and SLAs. 100,000 requests/month, 300 RPM, 50 API keys, custom adapters, dedicated support, $50/mo credits.",
      price: "299",
      priceCurrency: "USD",
      url: "https://toolroute.ai/pricing",
      availability: "https://schema.org/InStock",
      category: "Subscription",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "299",
        priceCurrency: "USD",
        unitText: "MONTH",
        billingIncrement: 1,
      },
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: {
      "@type": "Answer",
      text: a,
    },
  })),
};

export default function PricingPage() {
  return (
    <div className="space-y-24 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Header */}
      <section className="text-center pt-12">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
          <Zap className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-accent font-medium">Pricing</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-text-dim max-w-lg mx-auto text-sm leading-relaxed">
          Start free. Pay only for what you use. Every plan includes credits
          that work across all 70+ tools.
        </p>
      </section>

      {/* Plan Cards */}
      <section>
        <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-lg p-6 flex flex-col ${
                plan.highlighted
                  ? "border-2 border-accent bg-bg-card relative glow-accent"
                  : "border border-border bg-bg-card"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Recommended
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>
                <p className="text-text-dim text-xs mb-4">{plan.description}</p>
                <p className="text-4xl font-bold">
                  {plan.price}
                  <span className="text-sm text-text-muted font-normal">
                    {plan.period}
                  </span>
                </p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-text-dim"
                  >
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        plan.highlighted ? "text-accent" : "text-green"
                      }`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`block text-center text-sm py-2.5 rounded-lg transition-colors font-semibold ${
                  plan.highlighted
                    ? "bg-accent hover:bg-accent-hover text-white"
                    : "border border-border hover:border-accent/40 text-text"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">
          Plan Comparison
        </h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-card">
                  <th className="text-left p-4 text-text-muted font-medium text-xs uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="p-4 text-center text-text-muted font-medium text-xs uppercase tracking-wider">
                    Free
                  </th>
                  <th className="p-4 text-center text-accent font-medium text-xs uppercase tracking-wider">
                    Pro
                  </th>
                  <th className="p-4 text-center text-text-muted font-medium text-xs uppercase tracking-wider">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Requests", "100/day", "10K/mo", "100K/mo"],
                  ["Rate limit", "10 RPM", "60 RPM", "300 RPM"],
                  ["API keys", "2", "10", "50"],
                  ["Tools access", "Basic", "All", "All + custom"],
                  ["Priority routing", "---", "Yes", "Yes"],
                  ["BYOK support", "---", "Yes", "Yes"],
                  ["Usage analytics", "---", "Yes", "Yes"],
                  ["Included credits", "$1", "$5/mo", "$50/mo"],
                  ["Support", "Community", "Email", "Dedicated + SLA"],
                ].map(([feature, free, pro, enterprise]) => (
                  <tr key={feature} className="hover:bg-bg-card-hover transition-colors">
                    <td className="p-4 text-text">{feature}</td>
                    <td className="p-4 text-center text-text-dim">{free}</td>
                    <td className="p-4 text-center text-text">{pro}</td>
                    <td className="p-4 text-center text-text-dim">
                      {enterprise}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div
              key={q}
              className="border border-border rounded-lg p-5 bg-bg-card"
            >
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-accent shrink-0" />
                {q}
              </h3>
              <p className="text-sm text-text-dim leading-relaxed pl-6">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center">
        <div className="border border-border rounded-lg p-10 bg-bg-card max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-text-dim text-sm mb-6">
            Get your API key in seconds. Start with $1 in free credits.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Get Your API Key
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-text-dim hover:text-accent text-sm transition-colors"
            >
              Read the docs
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
