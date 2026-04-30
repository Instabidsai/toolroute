import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "OAuth for AI Agents: Composio vs Manual Implementation (2026)",
  description:
    "AI agents need OAuth to act on behalf of users. Compare building OAuth yourself vs using Composio. Code examples, token storage, refresh handling, and the hidden costs of rolling your own.",
  alternates: { canonical: "/blog/oauth-for-ai-agents-composio-vs-manual" },
  openGraph: {
    title: "OAuth for AI Agents: Composio vs Manual Implementation",
    description:
      "Build OAuth yourself or let Composio handle it? Full comparison with token storage, refresh logic, and multi-tenant considerations.",
    url: "https://toolroute.ai/blog/oauth-for-ai-agents-composio-vs-manual",
    type: "article",
    publishedTime: "2026-04-15T00:00:00Z",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Why do AI agents need OAuth instead of API keys?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "API keys belong to the developer. OAuth tokens belong to the end user. When an AI agent reads a user's Gmail or posts to their Slack, it needs OAuth because the action is performed on the user's behalf with the user's own permissions. API keys would mean every user shares one inbox and one Slack workspace, which breaks any multi-tenant product.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to build OAuth for one app yourself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Plan for 3 to 5 engineering days for the first OAuth integration, then 1 to 2 days per additional provider once you have shared infrastructure. This includes the authorization URL, callback handler, token storage, refresh logic, error recovery, revocation flow, and scope management. Multi-tenant SaaS adds another 2 to 3 days for tenant isolation.",
      },
    },
    {
      "@type": "Question",
      name: "What does Composio cost vs. building OAuth yourself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Composio has a free tier for early development and paid plans starting around 49 dollars per month for production use. Building OAuth yourself costs 3 to 5 engineer-days per integration, plus ongoing maintenance when providers rotate keys or change scopes. For more than 3 integrations, Composio is almost always cheaper than building.",
      },
    },
    {
      "@type": "Question",
      name: "Is Composio secure for storing OAuth tokens?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Composio encrypts tokens at rest and transmits them over TLS. They are SOC 2 Type II certified. Storing tokens yourself is also secure if you follow standard practices (encrypted at rest, HSM-backed keys, strict access logs), but most teams underestimate the operational overhead. For regulated industries, audit Composio's compliance documents or use their self-hosted option.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Composio through an MCP gateway like ToolRoute?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. ToolRoute exposes Composio's OAuth-backed tools through the same unified API as every other tool. You configure the Composio connection once per user, then your agent calls Gmail, Slack, Notion, or any of Composio's 60+ apps through a single endpoint. This combines OAuth simplification with tool routing and billing.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "OAuth for AI Agents: Composio vs Manual Implementation (2026)",
  description:
    "AI agents need OAuth to act on behalf of users. Compare building OAuth yourself vs using Composio, with code and hidden costs.",
  datePublished: "2026-04-15T00:00:00Z",
  author: { "@type": "Organization", name: "ToolRoute" },
  publisher: {
    "@type": "Organization",
    name: "ToolRoute",
    url: "https://toolroute.ai",
  },
  mainEntityOfPage:
    "https://toolroute.ai/blog/oauth-for-ai-agents-composio-vs-manual",
};

export default function Article() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-accent text-xs font-medium mb-4">Authentication</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            OAuth for AI Agents: Composio vs Manual Implementation
          </h1>
          <p className="text-text-dim text-sm leading-relaxed mb-4">
            The moment your AI agent needs to act on behalf of a user, API keys
            stop working. You need OAuth. Here is the honest comparison of
            building OAuth yourself vs. using Composio, with the hidden costs
            nobody mentions.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>April 15, 2026</span>
            <span>11 min read</span>
            <span>ToolRoute Team</span>
          </div>
        </header>

        <div className="prose-custom space-y-8 text-sm leading-relaxed">
          <p>
            Your first AI agent probably used an API key. You hardcoded it into
            an environment variable, the agent made calls, life was simple. Then
            your second user signed up. Now the agent needs to read <em>their</em>{" "}
            Gmail, not yours. It needs to post in <em>their</em> Slack workspace,
            not yours. The API key model breaks the moment you go multi-tenant.
          </p>
          <p>
            OAuth is the answer. It is also the single largest source of
            accidental complexity in AI agent products. A proper OAuth
            implementation for one provider takes a week. Doing it for ten
            providers, across multiple tenants, while handling token refresh,
            revocation, scope escalation, and provider-specific edge cases takes
            a full engineering quarter.
          </p>
          <p>
            There is an alternative. Composio abstracts OAuth for 60+ apps into
            a single connection flow. Below we walk through what rolling your
            own OAuth actually costs, what Composio does, and when each choice
            makes sense.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Why Agents Need OAuth, Not API Keys
          </h2>
          <p>
            API keys identify a developer. OAuth tokens identify a user. When
            an AI assistant reads your email to summarize it, the action has to
            run under your permissions, not the developer&apos;s. If a shared
            API key could read emails, it would read <em>every user&apos;s</em>{" "}
            emails, which is a security disaster.
          </p>
          <p>
            Three scenarios force OAuth:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Per-user data access.</strong> Gmail,
              Google Calendar, Notion, GitHub private repos, Linear, Asana,
              Salesforce.
            </li>
            <li>
              <strong className="text-text">Per-workspace write access.</strong>{" "}
              Slack posts, Discord messages, Trello cards, Jira tickets.
            </li>
            <li>
              <strong className="text-text">User-signed transactions.</strong>{" "}
              Stripe Connect, Shopify merchant APIs, HubSpot CRM updates.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            Building OAuth Yourself: What It Actually Takes
          </h2>
          <p>
            Most tutorials show you a happy-path OAuth 2.0 flow in 50 lines.
            Production reality is 500 to 2,000 lines per provider, plus shared
            infrastructure. Here is the full checklist:
          </p>

          <h3 className="text-base font-semibold pt-2">
            1. Register the app with each provider
          </h3>
          <p>
            Every provider has its own developer portal. You register a new app,
            set redirect URIs, request scopes, sometimes wait for manual
            approval (Slack app directory, Google sensitive scopes, Microsoft
            certification). Expect 1 to 5 business days for a sensitive-scope
            approval. Budget for multiple redirects per environment (local,
            preview, staging, production) per provider.
          </p>

          <h3 className="text-base font-semibold pt-2">
            2. Build the authorization flow
          </h3>
          <p>
            Construct the authorization URL, include a CSRF token (state param),
            handle the callback, exchange the code for tokens, store tokens
            securely. The code looks simple until you handle PKCE for public
            clients, dynamic scopes, and provider-specific query parameter
            quirks.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg p-4 my-4 overflow-x-auto">
            <pre className="text-xs text-text-dim">
              <code>{`// Simplified GitHub OAuth handler — production needs more
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // 1. Validate state against session (CSRF)
  // 2. Exchange code for tokens
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code: code!,
    }),
  });
  const { access_token, refresh_token, expires_in } = await tokenRes.json();

  // 3. Encrypt and store tokens per user
  // 4. Handle errors (revoked app, denied scope, expired code)
  // 5. Redirect back to the app with success/failure state
}`}</code>
            </pre>
          </div>

          <h3 className="text-base font-semibold pt-2">
            3. Secure token storage
          </h3>
          <p>
            Never store tokens in plaintext. Use authenticated encryption
            (AES-256-GCM with a KMS-managed key — this is on the ToolRoute
            security roadmap, Codex ticket #52), rotate the key annually,
            maintain an audit log for every token read. If you are in a
            regulated vertical, tokens must live in an HSM-backed store with
            strict IAM. Getting this wrong leaks every user&apos;s account.
          </p>

          <h3 className="text-base font-semibold pt-2">
            4. Token refresh logic
          </h3>
          <p>
            Access tokens expire. Refresh tokens expire too, just slower.
            Every API call needs to check token freshness, refresh if needed,
            handle races between concurrent refreshes, and recover when the
            refresh token itself is revoked. Providers differ: Google rotates
            refresh tokens, GitHub does not, Slack has complex token types for
            bots vs users.
          </p>

          <h3 className="text-base font-semibold pt-2">
            5. Revocation and error recovery
          </h3>
          <p>
            Users revoke access from the provider&apos;s settings page. Your app
            does not get a webhook for this. The first sign is an API call that
            returns 401. You need to detect, mark the connection dead, notify
            the user, and prompt a reconnect flow. If you do not, the agent
            silently fails on that user for weeks.
          </p>

          <h3 className="text-base font-semibold pt-2">
            6. Scope escalation
          </h3>
          <p>
            Users often grant minimal scopes initially. Later the agent needs a
            broader scope. You need a re-authorization flow that feels like a
            normal reconnect, not like a full onboarding restart. Few teams
            build this and most users drop off.
          </p>

          <h3 className="text-base font-semibold pt-2">
            7. Multi-tenant isolation
          </h3>
          <p>
            In a SaaS product, customer A&apos;s tokens must never touch customer
            B&apos;s agent. Add tenant IDs to every token record, add row-level
            security to the token table, ensure every agent call loads tokens
            scoped to the current tenant. Easy to describe, easy to get wrong.
          </p>

          <h2 className="text-xl font-bold pt-4">
            What Composio Does Instead
          </h2>
          <p>
            Composio is a managed service that handles OAuth for 60+ apps
            behind one API. The entire authorization flow becomes three steps:
          </p>

          <div className="bg-[#0d0d18] border border-border rounded-lg p-4 my-4 overflow-x-auto">
            <pre className="text-xs text-text-dim">
              <code>{`// 1. Initiate a connection for a user to Gmail
const connection = await composio.connections.initiate({
  integrationId: "gmail",
  userId: "user_123",
});
// Send user to connection.redirectUrl

// 2. Composio stores tokens, handles refresh, manages revocation

// 3. Call any Gmail action through a single endpoint
const result = await composio.actions.execute({
  actionId: "gmail_send_email",
  connectedAccountId: connection.id,
  params: {
    recipient: "customer@example.com",
    subject: "Order confirmed",
    body: "Thanks for your order...",
  },
});`}</code>
            </pre>
          </div>

          <p>
            Composio stores the tokens encrypted, refreshes them automatically,
            handles revocation detection, and exposes every action as a
            uniformly-shaped function call. Scope management, multi-tenant
            isolation, and provider-specific edge cases are all abstracted.
          </p>

          <h2 className="text-xl font-bold pt-4">
            Side-by-Side Comparison
          </h2>
          <div className="bg-bg-card border border-border rounded-lg p-6 my-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2 pr-4">Dimension</th>
                  <th className="text-left pb-2 pr-4">Manual</th>
                  <th className="text-left pb-2">Composio</th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Time per provider</td>
                  <td className="py-2 pr-4">1-5 days</td>
                  <td className="py-2 text-green">10 minutes</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Token storage</td>
                  <td className="py-2 pr-4">You own encryption</td>
                  <td className="py-2 text-green">Managed, SOC 2</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Refresh logic</td>
                  <td className="py-2 pr-4">Per-provider</td>
                  <td className="py-2 text-green">Automatic</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Revocation handling</td>
                  <td className="py-2 pr-4">Manual detection</td>
                  <td className="py-2 text-green">Built-in</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Multi-tenant</td>
                  <td className="py-2 pr-4">You build</td>
                  <td className="py-2 text-green">First-class</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Compliance</td>
                  <td className="py-2 pr-4">Your audit</td>
                  <td className="py-2 text-green">SOC 2 Type II</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Provider breakage</td>
                  <td className="py-2 pr-4">You fix</td>
                  <td className="py-2 text-green">Composio fixes</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Lock-in</td>
                  <td className="py-2 pr-4 text-green">None</td>
                  <td className="py-2">Moderate</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold pt-4">
            The Hidden Cost of Rolling Your Own
          </h2>
          <p>
            Engineers who have not built OAuth at scale routinely underestimate
            it by 3x. Here is what actually consumes the time:
          </p>
          <ul className="space-y-1.5 text-text-dim pl-4">
            <li>
              <strong className="text-text">Provider drift.</strong> Google
              changes a scope name, Slack deprecates a token type, GitHub
              enforces new PKCE rules. Expect 2 to 5 maintenance incidents per
              provider per year.
            </li>
            <li>
              <strong className="text-text">Debugging user-specific failures.</strong>{" "}
              &quot;Why can this user not connect Notion?&quot; is a multi-hour
              investigation every time.
            </li>
            <li>
              <strong className="text-text">Compliance audits.</strong> SOC 2
              auditors care how you store OAuth tokens. Composio&apos;s existing
              report is free leverage.
            </li>
            <li>
              <strong className="text-text">Support burden.</strong> Every
              provider has its own reconnect flow, and each one generates
              support tickets when users get confused.
            </li>
          </ul>

          <h2 className="text-xl font-bold pt-4">
            When Rolling Your Own Still Makes Sense
          </h2>
          <p>
            Composio is not always the right call. Three situations justify
            building OAuth yourself:
          </p>
          <ol className="space-y-1.5 text-text-dim pl-4 list-decimal">
            <li>
              <strong className="text-text">One provider forever.</strong> If
              your product only ever integrates with GitHub, a single hand-built
              OAuth flow is fine. The ROI of Composio improves with every added
              provider.
            </li>
            <li>
              <strong className="text-text">
                Regulatory prohibition on third-party token storage.
              </strong>{" "}
              Some healthcare and government contexts forbid tokens from
              touching third-party infrastructure. Either self-host Composio or
              build in-house.
            </li>
            <li>
              <strong className="text-text">Deep provider-specific features.</strong>{" "}
              If you need Gmail&apos;s advanced push notifications with custom
              pubsub topics, you may outgrow the abstraction. Most teams never
              hit this.
            </li>
          </ol>

          <h2 className="text-xl font-bold pt-4">
            Using Composio Through an MCP Gateway
          </h2>
          <p>
            Composio solves OAuth. A{" "}
            <Link href="/blog/what-is-an-mcp-gateway" className="text-accent hover:underline">
              gateway
            </Link>{" "}
            solves everything else: unified billing, unified protocol, unified
            tool catalog. Combining them is the cleanest architecture for a
            multi-tool agent product.
          </p>
          <p>
            ToolRoute routes through Composio for OAuth-heavy tools like Gmail,
            Slack, and Notion, while routing directly to stateless tools like
            Tavily or Resend. Your agent speaks one protocol and one API key to
            ToolRoute. ToolRoute handles the Composio connection handoff behind
            the scenes. You get the benefits of both abstractions without
            running two SDKs.
          </p>
          <div className="bg-[#0d0d18] border border-border rounded-lg p-4 my-4 overflow-x-auto">
            <pre className="text-xs text-text-dim">
              <code>{`// Agent calls through ToolRoute — Composio is invisible
await fetch("https://toolroute.ai/api/v1/execute", {
  method: "POST",
  headers: {
    Authorization: "Bearer $TOOLROUTE_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    // BYOK required for Resend; user_id maps to the connected account.
    tool: "resend/send-email",
    user_id: "user_123",
    input: {
      to: "customer@example.com",
      subject: "Your order",
      body: "Thanks for ordering",
    },
  }),
});`}</code>
            </pre>
          </div>

          <h2 className="text-xl font-bold pt-4">
            Decision Shortcut
          </h2>
          <p>
            Three integrations or more, a multi-tenant product, or any timeline
            pressure: use Composio. One integration, solo project, no OAuth
            expertise gap: build it yourself and learn from the pain. Anything
            in between: build Composio into your architecture from day one and
            save the migration tax later.
          </p>

          <h2 className="text-xl font-bold pt-4">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">
                Why do AI agents need OAuth instead of API keys?
              </h3>
              <p className="text-text-dim mt-1">
                API keys belong to the developer. OAuth tokens belong to the end
                user. When an agent reads a user&apos;s Gmail or posts to their
                Slack, the action runs under the user&apos;s permissions. API
                keys would mean every user shares one inbox, which breaks
                multi-tenancy.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                How long does it take to build OAuth for one app yourself?
              </h3>
              <p className="text-text-dim mt-1">
                3 to 5 engineering days for the first integration, then 1 to 2
                days per additional provider. Includes authorization URL,
                callback, token storage, refresh, error recovery, revocation,
                and scope management. Multi-tenant SaaS adds 2 to 3 days for
                tenant isolation.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                What does Composio cost vs. building OAuth yourself?
              </h3>
              <p className="text-text-dim mt-1">
                Composio has a free tier for development and paid plans from
                around $49/month for production. Building costs 3 to 5
                engineer-days per integration plus maintenance. Above 3
                integrations, Composio is almost always cheaper.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Is Composio secure for storing OAuth tokens?
              </h3>
              <p className="text-text-dim mt-1">
                Composio encrypts tokens at rest, uses TLS in transit, and is
                SOC 2 Type II certified. Storing tokens yourself is secure if
                you follow standard practices, but most teams underestimate the
                operational overhead. For regulated industries, audit Composio
                or use self-hosted.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Can I use Composio through an MCP gateway like ToolRoute?
              </h3>
              <p className="text-text-dim mt-1">
                Yes. ToolRoute exposes Composio&apos;s OAuth-backed tools
                through the same unified API as every other tool. Configure
                Composio once per user, then call Gmail, Slack, Notion, or any
                of 60+ apps through a single endpoint with unified billing.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <h3 className="font-semibold text-sm mb-4">Related Articles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/blog/composio-vs-zapier-ai-automation" className="text-accent hover:underline">
                  Composio vs Zapier MCP: Which Automation Platform to Use
                </Link>
              </li>
              <li>
                <Link href="/blog/bring-your-own-key-mcp-byok" className="text-accent hover:underline">
                  Bring Your Own Key (BYOK) for MCP Tools: How It Works
                </Link>
              </li>
              <li>
                <Link href="/blog/mcp-server-security-best-practices" className="text-accent hover:underline">
                  MCP Server Security Best Practices 2026
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-border pt-8 mt-8">
            <p className="text-text-dim">
              ToolRoute routes OAuth-backed tools through Composio and stateless
              tools directly, behind one API key.{" "}
              <Link href="/docs" className="text-accent hover:underline">
                Read the docs
              </Link>{" "}
              or{" "}
              <Link href="/tools" className="text-accent hover:underline">
                browse the 51-tool catalog
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
