import type { Metadata } from "next";
import Link from "next/link";
import { Zap, ArrowRight, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation — ToolRoute",
  description:
    "Developer documentation for the ToolRoute API. Authentication, endpoints, integration guides.",
};

/* ---------- TOC data ---------- */
const sections = [
  { id: "quickstart", label: "Quickstart" },
  { id: "authentication", label: "Authentication" },
  { id: "api-reference", label: "API Reference" },
  { id: "auto-routing", label: "Auto-Routing" },
  { id: "available-tools", label: "Available Tools" },
  { id: "error-handling", label: "Error Handling" },
  { id: "byok", label: "BYOK" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "sdks", label: "SDKs" },
  { id: "mcp-integration", label: "MCP Integration" },
] as const;

/* ---------- Helpers ---------- */
function CodeBlock({
  title,
  lang,
  children,
}: {
  title?: string;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0d18] border border-border rounded-lg overflow-hidden my-4">
      {(title || lang) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-card/50">
          <span className="text-[10px] text-text-muted">{title || lang}</span>
        </div>
      )}
      <pre className="p-4 text-xs sm:text-sm leading-relaxed overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold mt-16 mb-4 pt-4 border-t border-border scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function SubHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 id={id} className="text-lg font-semibold mt-8 mb-3 scroll-mt-24">
      {children}
    </h3>
  );
}

function Param({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-sm text-accent bg-accent/10 px-1.5 py-0.5 rounded">
          {name}
        </code>
        <span className="text-xs text-text-muted">{type}</span>
        {required && (
          <span className="text-[10px] text-red font-semibold uppercase">
            required
          </span>
        )}
      </div>
      <p className="text-sm text-text-dim pl-0">{children}</p>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

/* ---------- Tool Card ---------- */
function ToolCard({
  id,
  name,
  description,
  operations,
}: {
  id: string;
  name: string;
  description: string;
  operations: Array<{
    toolId: string;
    opName: string;
    description: string;
    params: Array<{
      name: string;
      type: string;
      required?: boolean;
      description: string;
    }>;
    pricing: string;
    exampleRequest: string;
    exampleResponse: string;
  }>;
}) {
  return (
    <div
      id={`tool-${id}`}
      className="border border-border rounded-lg bg-bg-card mb-8 scroll-mt-24"
    >
      <div className="px-5 py-4 border-b border-border">
        <h4 className="text-base font-bold">{name}</h4>
        <p className="text-sm text-text-dim mt-1">{description}</p>
        <p className="text-xs text-text-muted mt-1">
          Adapter slug: <InlineCode>{id}</InlineCode>
        </p>
      </div>
      {operations.map((op) => (
        <div key={op.toolId} className="px-5 py-4 border-b border-border last:border-0">
          <div className="flex items-center gap-3 mb-2">
            <code className="text-sm font-bold text-accent bg-accent/10 px-2 py-1 rounded">
              {op.toolId}
            </code>
            <span className="text-xs text-text-muted bg-bg-card px-2 py-0.5 rounded border border-border">
              {op.pricing}
            </span>
          </div>
          <p className="text-sm text-text-dim mb-3">{op.description}</p>

          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Parameters
          </p>
          <div className="border border-border rounded-lg mb-3">
            <div className="px-3">
              {op.params.map((p) => (
                <Param key={p.name} name={p.name} type={p.type} required={p.required}>
                  {p.description}
                </Param>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Example Request
          </p>
          <CodeBlock title="terminal">{op.exampleRequest}</CodeBlock>

          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Example Response
          </p>
          <CodeBlock title="json">{op.exampleResponse}</CodeBlock>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tool data ---------- */
const tools = [
  {
    id: "toolroute",
    name: "ToolRoute",
    description:
      "Query the ToolRoute capability registry. Check what exists before building, search for tools by keyword.",
    operations: [
      {
        toolId: "toolroute/check_before_build",
        opName: "Check Before Build",
        description:
          "Describe what you need to build and get back matching tools, installed inventory, category beliefs, and composites.",
        params: [
          {
            name: "task",
            type: "string",
            required: true,
            description:
              "Natural language description of what you want to build or accomplish.",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "toolroute/check_before_build", "input": {"task": "I need to send transactional emails"}}'`,
        exampleResponse: `{
  "id": "req_abc123",
  "tool": "toolroute/check_before_build",
  "provider": "toolroute",
  "data": {
    "matching_tools": [...],
    "installed": [...],
    "category_beliefs": [...],
    "composites": [...]
  },
  "usage": { "cost": 0.001, "balance_remaining": 9.99, "latency_ms": 120 }
}`,
      },
      {
        toolId: "toolroute/search",
        opName: "Search",
        description:
          "Full-text search across the tool registry by keyword.",
        params: [
          {
            name: "query",
            type: "string",
            required: true,
            description: "Search keyword or phrase.",
          },
          {
            name: "limit",
            type: "number",
            description: "Max results to return (default: 10).",
          },
        ],
        pricing: "$0.0005/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "toolroute/search", "input": {"query": "email", "limit": 5}}'`,
        exampleResponse: `{
  "id": "req_def456",
  "tool": "toolroute/search",
  "provider": "toolroute",
  "data": [
    { "name": "SendGrid", "slug": "sendgrid", "rating": 10, "description": "..." },
    { "name": "Resend", "slug": "resend", "rating": 9, "description": "..." }
  ],
  "usage": { "cost": 0.0005, "balance_remaining": 9.99, "latency_ms": 80 }
}`,
      },
    ],
  },
  {
    id: "context7",
    name: "Context7",
    description:
      "Library documentation lookup. Resolve library IDs and query up-to-date docs for any framework, SDK, or API.",
    operations: [
      {
        toolId: "context7/resolve-library",
        opName: "Resolve Library",
        description:
          "Resolve a library name (e.g. 'react', 'next.js') to a Context7 library ID for use in doc queries.",
        params: [
          {
            name: "library",
            type: "string",
            required: true,
            description:
              "Library or framework name to resolve (e.g. 'react', 'tailwindcss').",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "context7/resolve-library", "input": {"library": "next.js"}}'`,
        exampleResponse: `{
  "id": "req_ghi789",
  "tool": "context7/resolve-library",
  "provider": "context7",
  "data": {
    "id": "vercel/next.js",
    "name": "Next.js",
    "version": "15.2",
    "description": "The React Framework"
  },
  "usage": { "cost": 0.001, "balance_remaining": 9.99, "latency_ms": 150 }
}`,
      },
      {
        toolId: "context7/query-docs",
        opName: "Query Docs",
        description:
          "Query the documentation for a resolved library. Returns relevant doc snippets for your question.",
        params: [
          {
            name: "library_id",
            type: "string",
            required: true,
            description:
              "Library ID from resolve-library (e.g. 'vercel/next.js').",
          },
          {
            name: "query",
            type: "string",
            required: true,
            description:
              "Natural language question about the library (e.g. 'how to use server actions').",
          },
          {
            name: "tokens",
            type: "number",
            description: "Max tokens to return in the response (optional).",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "context7/query-docs", "input": {"library_id": "vercel/next.js", "query": "how to use server actions"}}'`,
        exampleResponse: `{
  "id": "req_jkl012",
  "tool": "context7/query-docs",
  "provider": "context7",
  "data": {
    "results": [
      { "title": "Server Actions and Mutations", "content": "Server Actions are...", "url": "..." }
    ]
  },
  "usage": { "cost": 0.001, "balance_remaining": 9.98, "latency_ms": 300 }
}`,
      },
    ],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description:
      "Text-to-speech. Generate natural-sounding audio from text or list available voices. BYOK supported.",
    operations: [
      {
        toolId: "elevenlabs/text-to-speech",
        opName: "Text to Speech",
        description:
          "Convert text to natural-sounding audio. Returns base64-encoded MP3.",
        params: [
          {
            name: "text",
            type: "string",
            required: true,
            description: "The text to convert to speech.",
          },
          {
            name: "voice_id",
            type: "string",
            description:
              "ElevenLabs voice ID. Defaults to Rachel (21m00Tcm4TlvDq8ikWAM).",
          },
          {
            name: "model_id",
            type: "string",
            description:
              "Model to use. Defaults to eleven_monolingual_v1.",
          },
        ],
        pricing: "$0.0003/character",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "elevenlabs/text-to-speech", "input": {"text": "Hello from ToolRoute!", "voice_id": "21m00Tcm4TlvDq8ikWAM"}}'`,
        exampleResponse: `{
  "id": "req_mno345",
  "tool": "elevenlabs/text-to-speech",
  "provider": "elevenlabs",
  "data": {
    "audio_base64": "SUQzBAAAAAAAI1RTU0UAAAA...",
    "content_type": "audio/mpeg",
    "char_count": 21
  },
  "usage": { "cost": 0.0063, "balance_remaining": 9.97, "latency_ms": 800 }
}`,
      },
      {
        toolId: "elevenlabs/voices",
        opName: "List Voices",
        description:
          "List all available voices in your ElevenLabs account.",
        params: [],
        pricing: "$0.0001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "elevenlabs/voices", "input": {}}'`,
        exampleResponse: `{
  "id": "req_pqr678",
  "tool": "elevenlabs/voices",
  "provider": "elevenlabs",
  "data": {
    "voices": [
      { "voice_id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "category": "premade" },
      { "voice_id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella", "category": "premade" }
    ]
  },
  "usage": { "cost": 0.0001, "balance_remaining": 9.97, "latency_ms": 200 }
}`,
      },
    ],
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    description:
      "Web scraping and crawling. Extract markdown, HTML, or site maps from any URL. BYOK supported.",
    operations: [
      {
        toolId: "firecrawl/scrape",
        opName: "Scrape",
        description:
          "Scrape a single URL and extract its content as markdown, HTML, or structured data.",
        params: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "The URL to scrape.",
          },
          {
            name: "formats",
            type: "string[]",
            description:
              "Output formats to return (e.g. ['markdown', 'html']). Defaults to markdown.",
          },
        ],
        pricing: "$0.005/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "firecrawl/scrape", "input": {"url": "https://example.com"}}'`,
        exampleResponse: `{
  "id": "req_stu901",
  "tool": "firecrawl/scrape",
  "provider": "firecrawl",
  "data": {
    "success": true,
    "data": {
      "markdown": "# Example Domain\\n\\nThis domain is for use in illustrative examples...",
      "metadata": { "title": "Example Domain", "statusCode": 200 }
    }
  },
  "usage": { "cost": 0.005, "balance_remaining": 9.96, "latency_ms": 1200 }
}`,
      },
      {
        toolId: "firecrawl/crawl",
        opName: "Crawl",
        description:
          "Crawl an entire website starting from a URL. Returns content from multiple pages.",
        params: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "The starting URL to crawl.",
          },
          {
            name: "limit",
            type: "number",
            description: "Max pages to crawl (default: 10).",
          },
        ],
        pricing: "$0.01/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "firecrawl/crawl", "input": {"url": "https://docs.example.com", "limit": 5}}'`,
        exampleResponse: `{
  "id": "req_vwx234",
  "tool": "firecrawl/crawl",
  "provider": "firecrawl",
  "data": {
    "success": true,
    "id": "crawl_abc",
    "status": "completed",
    "total": 5,
    "data": [{ "markdown": "...", "metadata": { "sourceURL": "..." } }]
  },
  "usage": { "cost": 0.01, "balance_remaining": 9.95, "latency_ms": 5000 }
}`,
      },
      {
        toolId: "firecrawl/map",
        opName: "Map",
        description:
          "Generate a site map of all URLs on a website. Useful for discovery before crawling.",
        params: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "The website URL to map.",
          },
        ],
        pricing: "$0.003/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "firecrawl/map", "input": {"url": "https://example.com"}}'`,
        exampleResponse: `{
  "id": "req_yza567",
  "tool": "firecrawl/map",
  "provider": "firecrawl",
  "data": {
    "success": true,
    "links": [
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/docs"
    ]
  },
  "usage": { "cost": 0.003, "balance_remaining": 9.95, "latency_ms": 800 }
}`,
      },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description:
      "Email sending. Deliver transactional and marketing emails via the SendGrid API. BYOK supported.",
    operations: [
      {
        toolId: "sendgrid/send-email",
        opName: "Send Email",
        description:
          "Send a transactional email with text and/or HTML content.",
        params: [
          {
            name: "to",
            type: "string",
            required: true,
            description: "Recipient email address.",
          },
          {
            name: "from",
            type: "string",
            required: true,
            description: "Sender email address (must be verified in SendGrid).",
          },
          {
            name: "subject",
            type: "string",
            required: true,
            description: "Email subject line.",
          },
          {
            name: "text",
            type: "string",
            description: "Plain text body. At least one of text or html required.",
          },
          {
            name: "html",
            type: "string",
            description: "HTML body. At least one of text or html required.",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "sendgrid/send-email", "input": {
    "to": "user@example.com",
    "from": "noreply@yourapp.com",
    "subject": "Welcome!",
    "html": "<h1>Welcome to our app</h1><p>Thanks for signing up.</p>"
  }}'`,
        exampleResponse: `{
  "id": "req_bcd890",
  "tool": "sendgrid/send-email",
  "provider": "sendgrid",
  "data": { "message": "Email sent successfully", "status": 202 },
  "usage": { "cost": 0.001, "balance_remaining": 9.94, "latency_ms": 400 }
}`,
      },
    ],
  },
  {
    id: "playwright",
    name: "Playwright",
    description:
      "Browser automation. Take screenshots, extract text, and generate PDFs from any URL via remote rendering.",
    operations: [
      {
        toolId: "playwright/screenshot",
        opName: "Screenshot",
        description:
          "Capture a screenshot of a webpage at a specified resolution.",
        params: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "The URL to screenshot.",
          },
          {
            name: "width",
            type: "number",
            description: "Viewport width in pixels (default: 1280).",
          },
          {
            name: "height",
            type: "number",
            description: "Viewport height in pixels (default: 720).",
          },
        ],
        pricing: "$0.005/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "playwright/screenshot", "input": {"url": "https://example.com", "width": 1920, "height": 1080}}'`,
        exampleResponse: `{
  "id": "req_efg123",
  "tool": "playwright/screenshot",
  "provider": "playwright",
  "data": {
    "image_url": "https://image.thum.io/get/width/1920/crop/1080/https://example.com",
    "width": 1920,
    "height": 1080,
    "source_url": "https://example.com"
  },
  "usage": { "cost": 0.005, "balance_remaining": 9.93, "latency_ms": 600 }
}`,
      },
      {
        toolId: "playwright/scrape-text",
        opName: "Scrape Text",
        description:
          "Extract visible text content from a webpage (strips HTML tags, scripts, and styles).",
        params: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "The URL to extract text from.",
          },
        ],
        pricing: "$0.002/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "playwright/scrape-text", "input": {"url": "https://example.com"}}'`,
        exampleResponse: `{
  "id": "req_hij456",
  "tool": "playwright/scrape-text",
  "provider": "playwright",
  "data": {
    "text": "Example Domain This domain is for use in illustrative examples...",
    "length": 1256,
    "truncated": false,
    "source_url": "https://example.com"
  },
  "usage": { "cost": 0.002, "balance_remaining": 9.93, "latency_ms": 300 }
}`,
      },
      {
        toolId: "playwright/pdf",
        opName: "PDF",
        description:
          "Generate a PDF of a webpage. Returns a URL to the rendered PDF.",
        params: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "The URL to render as PDF.",
          },
        ],
        pricing: "$0.005/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "playwright/pdf", "input": {"url": "https://example.com"}}'`,
        exampleResponse: `{
  "id": "req_klm789",
  "tool": "playwright/pdf",
  "provider": "playwright",
  "data": {
    "pdf_url": "https://image.thum.io/get/pdf/https://example.com",
    "source_url": "https://example.com"
  },
  "usage": { "cost": 0.005, "balance_remaining": 9.92, "latency_ms": 700 }
}`,
      },
    ],
  },
  {
    id: "claude",
    name: "Claude (Anthropic)",
    description:
      "Anthropic Claude LLM. Send chat and completion requests through the ToolRoute gateway. BYOK supported.",
    operations: [
      {
        toolId: "claude/chat",
        opName: "Chat",
        description:
          "Send a multi-turn conversation to Claude and get a response.",
        params: [
          {
            name: "messages",
            type: "array",
            required: true,
            description:
              'Array of message objects with role and content (e.g. [{"role":"user","content":"Hello"}]).',
          },
          {
            name: "model",
            type: "string",
            description:
              "Model ID. Defaults to claude-sonnet-4-20250514.",
          },
          {
            name: "max_tokens",
            type: "number",
            description: "Max tokens in the response (default: 1024).",
          },
          {
            name: "system",
            type: "string",
            description: "System prompt to set context for the conversation.",
          },
          {
            name: "temperature",
            type: "number",
            description: "Sampling temperature (0-1). Lower = more deterministic.",
          },
        ],
        pricing: "$0.003/1K chars",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "claude/chat", "input": {
    "messages": [{"role": "user", "content": "Explain REST APIs in 2 sentences."}],
    "max_tokens": 256
  }}'`,
        exampleResponse: `{
  "id": "req_nop012",
  "tool": "claude/chat",
  "provider": "claude",
  "data": {
    "content": [{ "type": "text", "text": "REST APIs use HTTP methods..." }],
    "model": "claude-sonnet-4-20250514",
    "usage": { "input_tokens": 15, "output_tokens": 48 },
    "stop_reason": "end_turn"
  },
  "usage": { "cost": 0.003, "balance_remaining": 9.92, "latency_ms": 1500 }
}`,
      },
      {
        toolId: "claude/complete",
        opName: "Complete",
        description:
          "Same as chat. Alias for agents that prefer the 'complete' naming convention.",
        params: [
          {
            name: "messages",
            type: "array",
            required: true,
            description:
              'Array of message objects with role and content.',
          },
          {
            name: "model",
            type: "string",
            description:
              "Model ID. Defaults to claude-sonnet-4-20250514.",
          },
          {
            name: "max_tokens",
            type: "number",
            description: "Max tokens in the response (default: 1024).",
          },
          {
            name: "system",
            type: "string",
            description: "System prompt.",
          },
          {
            name: "temperature",
            type: "number",
            description: "Sampling temperature (0-1).",
          },
        ],
        pricing: "$0.003/1K chars",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "claude/complete", "input": {
    "messages": [{"role": "user", "content": "Summarize this: ..."}],
    "system": "You are a concise summarizer.",
    "max_tokens": 512
  }}'`,
        exampleResponse: `{
  "id": "req_qrs345",
  "tool": "claude/complete",
  "provider": "claude",
  "data": {
    "content": [{ "type": "text", "text": "The text describes..." }],
    "model": "claude-sonnet-4-20250514",
    "usage": { "input_tokens": 120, "output_tokens": 85 },
    "stop_reason": "end_turn"
  },
  "usage": { "cost": 0.006, "balance_remaining": 9.91, "latency_ms": 2000 }
}`,
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description:
      "GitHub API. Search repositories, read READMEs, and list issues. Works with optional BYOK token for higher rate limits.",
    operations: [
      {
        toolId: "github/search-repos",
        opName: "Search Repos",
        description:
          "Search GitHub repositories by keyword. Returns name, description, stars, language, and topics.",
        params: [
          {
            name: "query",
            type: "string",
            required: true,
            description: "Search query (same syntax as GitHub search).",
          },
          {
            name: "per_page",
            type: "number",
            description: "Results per page (default: 10, max: 100).",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "github/search-repos", "input": {"query": "mcp server typescript", "per_page": 5}}'`,
        exampleResponse: `{
  "id": "req_tuv678",
  "tool": "github/search-repos",
  "provider": "github",
  "data": {
    "total_count": 342,
    "items": [
      {
        "full_name": "anthropics/mcp-server",
        "description": "Model Context Protocol server reference",
        "html_url": "https://github.com/anthropics/mcp-server",
        "stargazers_count": 1200,
        "language": "TypeScript",
        "updated_at": "2026-04-10T00:00:00Z",
        "topics": ["mcp", "ai", "typescript"]
      }
    ]
  },
  "usage": { "cost": 0.001, "balance_remaining": 9.90, "latency_ms": 400 }
}`,
      },
      {
        toolId: "github/get-readme",
        opName: "Get README",
        description:
          "Fetch and decode the README file for a repository.",
        params: [
          {
            name: "owner",
            type: "string",
            required: true,
            description: "Repository owner (user or org).",
          },
          {
            name: "repo",
            type: "string",
            required: true,
            description: "Repository name.",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "github/get-readme", "input": {"owner": "vercel", "repo": "next.js"}}'`,
        exampleResponse: `{
  "id": "req_wxy901",
  "tool": "github/get-readme",
  "provider": "github",
  "data": {
    "name": "README.md",
    "path": "README.md",
    "content": "# Next.js\\n\\nThe React Framework for the Web...",
    "html_url": "https://github.com/vercel/next.js/blob/canary/readme.md",
    "size": 8540
  },
  "usage": { "cost": 0.001, "balance_remaining": 9.90, "latency_ms": 250 }
}`,
      },
      {
        toolId: "github/list-issues",
        opName: "List Issues",
        description:
          "List issues for a repository with filtering by state.",
        params: [
          {
            name: "owner",
            type: "string",
            required: true,
            description: "Repository owner.",
          },
          {
            name: "repo",
            type: "string",
            required: true,
            description: "Repository name.",
          },
          {
            name: "state",
            type: "string",
            description:
              "Filter by state: 'open', 'closed', or 'all' (default: 'open').",
          },
          {
            name: "per_page",
            type: "number",
            description: "Results per page (default: 10).",
          },
        ],
        pricing: "$0.001/call",
        exampleRequest: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "github/list-issues", "input": {"owner": "facebook", "repo": "react", "state": "open", "per_page": 3}}'`,
        exampleResponse: `{
  "id": "req_zab234",
  "tool": "github/list-issues",
  "provider": "github",
  "data": {
    "count": 3,
    "issues": [
      {
        "number": 28456,
        "title": "Bug: useEffect cleanup not called...",
        "state": "open",
        "html_url": "https://github.com/facebook/react/issues/28456",
        "user": "contributor123",
        "labels": ["Status: Unconfirmed"],
        "created_at": "2026-04-01T00:00:00Z",
        "updated_at": "2026-04-10T00:00:00Z",
        "comments": 5
      }
    ]
  },
  "usage": { "cost": 0.001, "balance_remaining": 9.89, "latency_ms": 300 }
}`,
      },
    ],
  },
];

/* ---------- Page ---------- */
export default function DocsPage() {
  return (
    <div className="flex gap-8 pb-16">
      {/* Sidebar TOC */}
      <aside className="hidden lg:block w-56 shrink-0">
        <nav className="sticky top-20 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3 font-semibold">
            On this page
          </p>
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="block text-sm text-text-dim hover:text-accent transition-colors py-1 border-l-2 border-transparent hover:border-accent pl-3"
            >
              {label}
            </a>
          ))}
          <div className="border-t border-border mt-4 pt-4">
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-semibold">
              Tools
            </p>
            {tools.map((t) => (
              <a
                key={t.id}
                href={`#tool-${t.id}`}
                className="block text-sm text-text-dim hover:text-accent transition-colors py-0.5 border-l-2 border-transparent hover:border-accent pl-3"
              >
                {t.name}
              </a>
            ))}
          </div>
          <div className="border-t border-border mt-4 pt-4">
            <Link
              href="/tools"
              className="block text-sm text-text-dim hover:text-accent transition-colors py-1 pl-3"
            >
              Browse Tools
            </Link>
            <Link
              href="/pricing"
              className="block text-sm text-text-dim hover:text-accent transition-colors py-1 pl-3"
            >
              Pricing
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <article className="flex-1 min-w-0 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs text-accent font-medium">Docs</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            ToolRoute API Documentation
          </h1>
          <p className="text-text-dim leading-relaxed">
            Everything you need to integrate ToolRoute into your AI agents,
            scripts, and applications. One API key, 8 gateway adapters, 18
            operations.
          </p>
        </div>

        {/* Quickstart */}
        <SectionHeading id="quickstart">Quickstart</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get up and running in under a minute.
        </p>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              1
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Sign up at toolroute.ai</p>
              <p className="text-sm text-text-dim">
                Create an account with email or GitHub. Takes 10 seconds.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              2
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">
                Get your API key from the dashboard
              </p>
              <p className="text-sm text-text-dim">
                Navigate to{" "}
                <Link href="/login" className="text-accent hover:underline">
                  Dashboard &rarr; API Keys
                </Link>{" "}
                and create a key. It starts with{" "}
                <InlineCode>tr_live_</InlineCode>.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              3
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">
                Make your first request
              </p>
              <CodeBlock title="terminal">
                {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "firecrawl/scrape", "input": {"url": "https://example.com"}}'`}
              </CodeBlock>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
              4
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Check your balance</p>
              <CodeBlock title="terminal">
                {`curl https://toolroute.ai/api/v1/key \\
  -H "Authorization: Bearer tr_live_xxx"`}
              </CodeBlock>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <SectionHeading id="authentication">Authentication</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          All API requests require a valid API key sent via the{" "}
          <InlineCode>Authorization</InlineCode> header.
        </p>
        <CodeBlock title="Header format">
          {`Authorization: Bearer tr_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
        </CodeBlock>
        <div className="border border-border rounded-lg p-4 bg-bg-card my-4">
          <p className="text-sm text-text-dim leading-relaxed">
            <strong className="text-text">Security:</strong> API keys are
            SHA-256 hashed before storage. We never store the raw key. You can
            only see the full key once at creation time. Treat it like a
            password.
          </p>
        </div>
        <p className="text-text-dim text-sm leading-relaxed">
          Create and manage keys from{" "}
          <Link href="/login" className="text-accent hover:underline">
            your dashboard
          </Link>
          . Each key can be named and revoked independently.
        </p>

        {/* API Reference */}
        <SectionHeading id="api-reference">API Reference</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-6">
          Base URL: <InlineCode>https://toolroute.ai/api/v1</InlineCode>
        </p>

        {/* POST /execute */}
        <SubHeading>
          <span className="inline-block bg-green/10 text-green text-xs font-bold px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/v1/execute
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Execute a tool. This is the primary endpoint for all tool calls.
        </p>
        <div className="border border-border rounded-lg bg-bg-card mb-4">
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Request Body
            </p>
          </div>
          <div className="px-4">
            <Param name="tool" type="string" required>
              Tool identifier in{" "}
              <InlineCode>provider/operation</InlineCode> format. Example:{" "}
              <InlineCode>elevenlabs/text-to-speech</InlineCode>
            </Param>
            <Param name="input" type="object" required>
              Tool-specific input parameters. See each tool&apos;s documentation
              below.
            </Param>
            <Param name="provider" type="object">
              Optional provider routing preferences. Supports{" "}
              <InlineCode>prefer</InlineCode> (preferred provider name),{" "}
              <InlineCode>allow_fallbacks</InlineCode> (boolean),{" "}
              <InlineCode>max_price</InlineCode> (number),{" "}
              <InlineCode>max_latency_ms</InlineCode> (number).
            </Param>
          </div>
        </div>
        <CodeBlock title="Example request">
          {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "elevenlabs/text-to-speech",
    "input": {
      "text": "Hello world",
      "voice_id": "21m00Tcm4TlvDq8ikWAM"
    }
  }'`}
        </CodeBlock>
        <div className="border border-border rounded-lg bg-bg-card mb-4">
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Response
            </p>
          </div>
          <div className="px-4">
            <Param name="id" type="string">
              Unique execution ID for tracking and debugging.
            </Param>
            <Param name="tool" type="string">
              The tool that was executed.
            </Param>
            <Param name="provider" type="string">
              The provider that handled the request.
            </Param>
            <Param name="data" type="object">
              Tool-specific response data.
            </Param>
            <Param name="usage" type="object">
              Credits consumed:{" "}
              <InlineCode>cost</InlineCode>,{" "}
              <InlineCode>balance_remaining</InlineCode>,{" "}
              <InlineCode>latency_ms</InlineCode>.
            </Param>
          </div>
        </div>

        {/* GET /tools */}
        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/tools
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          List all available tools. No authentication required. Supports
          filtering by category and search query.
        </p>
        <div className="border border-border rounded-lg bg-bg-card mb-4">
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Query Parameters
            </p>
          </div>
          <div className="px-4">
            <Param name="category" type="string">
              Filter by super_category slug.
            </Param>
            <Param name="q" type="string">
              Search query to filter tools.
            </Param>
            <Param name="limit" type="integer">
              Max results to return (default: 50).
            </Param>
          </div>
        </div>
        <CodeBlock title="terminal">
          {`curl https://toolroute.ai/api/v1/tools`}
        </CodeBlock>

        {/* GET /key */}
        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/key
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get information about your API key, including remaining credits and
          plan details.
        </p>
        <CodeBlock title="terminal">
          {`curl https://toolroute.ai/api/v1/key \\
  -H "Authorization: Bearer tr_live_xxx"`}
        </CodeBlock>

        {/* POST /keys */}
        <SubHeading>
          <span className="inline-block bg-green/10 text-green text-xs font-bold px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/v1/keys
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Create a new API key. Requires session authentication (logged in via
          dashboard).
        </p>
        <CodeBlock title="terminal">
          {`curl -X POST https://toolroute.ai/api/v1/keys \\
  -H "Content-Type: application/json" \\
  -H "Cookie: sb-access-token=..." \\
  -d '{"name": "production-key"}'`}
        </CodeBlock>

        {/* GET /usage */}
        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/usage
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get your usage history, including tool calls, credits consumed, and
          timestamps. Supports filtering by tool and date.
        </p>
        <CodeBlock title="terminal">
          {`curl "https://toolroute.ai/api/v1/usage?limit=20&tool=firecrawl/scrape" \\
  -H "Authorization: Bearer tr_live_xxx"`}
        </CodeBlock>

        {/* POST /checkout */}
        <SubHeading>
          <span className="inline-block bg-green/10 text-green text-xs font-bold px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/v1/checkout
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Create a Stripe checkout session to add credits. Minimum $5.
        </p>
        <CodeBlock title="terminal">
          {`curl -X POST https://toolroute.ai/api/v1/checkout \\
  -H "Content-Type: application/json" \\
  -H "Cookie: sb-access-token=..." \\
  -d '{"amount": 10}'`}
        </CodeBlock>

        {/* Auto-Routing */}
        <SectionHeading id="auto-routing">Auto-Routing</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Don&apos;t know which tool to use? Use the{" "}
          <InlineCode>toolroute/check_before_build</InlineCode> operation to
          describe your task in natural language. ToolRoute will search its
          registry and return matching tools, composites, and category beliefs
          ranked by confidence.
        </p>
        <CodeBlock title="Auto-route request">
          {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "toolroute/check_before_build",
    "input": { "task": "I need to scrape a website and send the content via email" }
  }'`}
        </CodeBlock>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          The response includes matching tools ranked by relevance, installed
          inventory, category beliefs with confidence scores, and composites
          (multi-tool combinations) that solve your task.
        </p>
        <div className="border border-border rounded-lg p-4 bg-bg-card my-4">
          <p className="text-sm text-text-dim leading-relaxed">
            <strong className="text-text">How beliefs work:</strong>{" "}
            ToolRoute maintains living confidence scores for each tool in each
            category, updated from real usage data. When you call{" "}
            <InlineCode>check_before_build</InlineCode>, you get the current
            &quot;best tool&quot; for each matching category along with the
            confidence level (0.6 = community-tested, 0.85 = team-tested).
          </p>
        </div>

        {/* Available Tools */}
        <SectionHeading id="available-tools">Available Tools</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          ToolRoute provides 8 gateway adapters with 18 total operations.
          Each operation is accessed via{" "}
          <InlineCode>POST /api/v1/execute</InlineCode> with the tool ID in
          <InlineCode>provider/operation</InlineCode> format.
        </p>

        {/* Quick reference table */}
        <div className="border border-border rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Adapter
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Operations
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  BYOK
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Pricing
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["toolroute", "check_before_build, search", "N/A", "$0.0005-$0.001"],
                ["context7", "resolve-library, query-docs", "No", "$0.001"],
                ["elevenlabs", "text-to-speech, voices", "Yes", "$0.0001-$0.0003/char"],
                ["firecrawl", "scrape, crawl, map", "Yes", "$0.003-$0.01"],
                ["sendgrid", "send-email", "Yes", "$0.001"],
                ["playwright", "screenshot, scrape-text, pdf", "No", "$0.002-$0.005"],
                ["claude", "chat, complete", "Yes", "$0.003/1K chars"],
                ["github", "search-repos, get-readme, list-issues", "Yes", "$0.001"],
              ].map(([adapter, ops, byok, pricing]) => (
                <tr
                  key={adapter}
                  className="hover:bg-bg-card-hover transition-colors"
                >
                  <td className="p-3 text-text font-medium">
                    <a
                      href={`#tool-${adapter}`}
                      className="text-accent hover:underline"
                    >
                      {adapter}
                    </a>
                  </td>
                  <td className="p-3 text-text-dim font-mono text-xs">{ops}</td>
                  <td className="p-3 text-text-dim">{byok}</td>
                  <td className="p-3 text-text-dim">{pricing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detailed tool cards */}
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            id={tool.id}
            name={tool.name}
            description={tool.description}
            operations={tool.operations}
          />
        ))}

        <p className="text-sm mt-4">
          <Link
            href="/tools"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse the full tool registry <ArrowRight className="w-4 h-4" />
          </Link>
        </p>

        {/* Error Handling */}
        <SectionHeading id="error-handling">Error Handling</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          All errors follow a consistent format with an HTTP status code and a
          machine-readable error code.
        </p>
        <CodeBlock title="Error response format">
          {`{
  "error": {
    "message": "Human-readable error description",
    "code": "machine_readable_code"
  }
}`}
        </CodeBlock>

        <SubHeading>HTTP Status Codes</SubHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Code
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["400", "Bad Request -- Invalid parameters or missing required fields"],
                ["401", "Unauthorized -- Missing or invalid API key"],
                ["402", "Payment Required -- Insufficient credits"],
                ["403", "Forbidden -- Key does not have access to this tool"],
                ["404", "Not Found -- Tool does not exist in the registry"],
                ["429", "Too Many Requests -- Rate limit exceeded (check Retry-After header)"],
                ["500", "Internal Server Error -- Gateway or upstream provider failure"],
              ].map(([code, meaning]) => (
                <tr key={code} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3">
                    <code className="text-xs text-red bg-red/10 px-1.5 py-0.5 rounded">
                      {code}
                    </code>
                  </td>
                  <td className="p-3 text-text-dim">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SubHeading>Error Codes</SubHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Error Code
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  HTTP Status
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["invalid_request", "400", "Missing required fields or invalid input format"],
                ["invalid_json", "400", "Request body is not valid JSON"],
                ["missing_tool", "400", "The 'tool' field is missing from the request"],
                ["missing_input", "400", "The 'input' field is missing or not an object"],
                ["authentication_required", "401", "No Authorization header provided"],
                ["invalid_api_key", "401", "API key not found, expired, or revoked"],
                ["insufficient_balance", "402", "Account has no remaining credits"],
                ["tool_not_found", "404", "The tool identifier does not match any adapter"],
                ["rate_limit_exceeded", "429", "Too many requests; retry after Retry-After seconds"],
                ["adapter_error", "500", "The upstream tool provider returned an error"],
                ["provider_error", "500", "Upstream provider is down or unreachable"],
                ["internal_error", "500", "Unexpected ToolRoute server error"],
              ].map(([code, status, desc]) => (
                <tr key={code} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3">
                    <code className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      {code}
                    </code>
                  </td>
                  <td className="p-3 text-text-dim">{status}</td>
                  <td className="p-3 text-text-dim">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BYOK */}
        <SectionHeading id="byok">BYOK (Bring Your Own Key)</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          On Pro and Enterprise plans, you can register your own API keys for
          supported tools. When you use BYOK:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-text-dim mb-4 pl-2">
          <li>
            Requests are routed through your own key with{" "}
            <strong className="text-text">zero markup</strong>
          </li>
          <li>You only pay the provider directly</li>
          <li>ToolRoute still handles routing, logging, and fallbacks</li>
          <li>Keys are encrypted at rest with AES-256</li>
        </ul>

        <SubHeading>BYOK-supported adapters</SubHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Adapter
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Provider Key Name
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["elevenlabs", "ElevenLabs API Key (xi-api-key)"],
                ["firecrawl", "Firecrawl API Key"],
                ["sendgrid", "SendGrid API Key"],
                ["claude", "Anthropic API Key (x-api-key)"],
                ["github", "GitHub Personal Access Token"],
              ].map(([adapter, keyName]) => (
                <tr key={adapter} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3 text-text font-medium">{adapter}</td>
                  <td className="p-3 text-text-dim">{keyName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <CodeBlock title="Register a BYOK key">
          {`curl -X POST https://toolroute.ai/api/v1/provider-keys \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "elevenlabs",
    "api_key": "your-elevenlabs-key-here"
  }'`}
        </CodeBlock>

        {/* Rate Limits */}
        <SectionHeading id="rate-limits">Rate Limits</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Rate limits are applied per API key.
        </p>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  RPM
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Daily / Monthly
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-bg-card-hover transition-colors">
                <td className="p-3 text-text">Free</td>
                <td className="p-3 text-text-dim">10</td>
                <td className="p-3 text-text-dim">100/day</td>
              </tr>
              <tr className="hover:bg-bg-card-hover transition-colors">
                <td className="p-3 text-accent font-medium">Pro</td>
                <td className="p-3 text-text-dim">60</td>
                <td className="p-3 text-text-dim">10,000/month</td>
              </tr>
              <tr className="hover:bg-bg-card-hover transition-colors">
                <td className="p-3 text-text">Enterprise</td>
                <td className="p-3 text-text-dim">300</td>
                <td className="p-3 text-text-dim">100,000/month</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-text-dim text-sm leading-relaxed">
          When rate limited, the API returns{" "}
          <InlineCode>429 Too Many Requests</InlineCode> with a{" "}
          <InlineCode>Retry-After</InlineCode> header indicating how many
          seconds to wait before retrying.
        </p>

        {/* SDKs */}
        <SectionHeading id="sdks">SDKs</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          ToolRoute works with any HTTP client. Below are examples for common
          languages.
        </p>

        <SubHeading>Python</SubHeading>
        <CodeBlock lang="python">
          {`import requests

TOOLROUTE_KEY = "tr_live_xxx"
BASE = "https://toolroute.ai/api/v1"

def toolroute(tool: str, input: dict) -> dict:
    """Execute any ToolRoute tool."""
    r = requests.post(
        f"{BASE}/execute",
        headers={"Authorization": f"Bearer {TOOLROUTE_KEY}"},
        json={"tool": tool, "input": input},
    )
    r.raise_for_status()
    return r.json()

# Example: scrape a webpage
result = toolroute("firecrawl/scrape", {"url": "https://example.com"})
print(result["data"])

# Example: check what tools exist before building
matches = toolroute("toolroute/check_before_build", {"task": "send emails"})
print(matches["data"]["matching_tools"])

# Example: text-to-speech
audio = toolroute("elevenlabs/text-to-speech", {"text": "Hello from Python!"})
import base64
with open("output.mp3", "wb") as f:
    f.write(base64.b64decode(audio["data"]["audio_base64"]))`}
        </CodeBlock>

        <SubHeading>JavaScript / TypeScript</SubHeading>
        <CodeBlock lang="typescript">
          {`const TOOLROUTE_KEY = "tr_live_xxx";
const BASE = "https://toolroute.ai/api/v1";

async function toolroute(tool: string, input: Record<string, unknown>) {
  const res = await fetch(\`\${BASE}/execute\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${TOOLROUTE_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, input }),
  });
  if (!res.ok) throw new Error(\`ToolRoute error: \${res.status}\`);
  return res.json();
}

// Scrape a webpage
const page = await toolroute("firecrawl/scrape", { url: "https://example.com" });

// Search GitHub repos
const repos = await toolroute("github/search-repos", { query: "mcp tools" });

// Chat with Claude
const chat = await toolroute("claude/chat", {
  messages: [{ role: "user", content: "Explain MCP in one sentence." }],
});
console.log(chat.data.content[0].text);`}
        </CodeBlock>

        <SubHeading>curl</SubHeading>
        <CodeBlock title="terminal">
          {`# Execute a tool
curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "sendgrid/send-email", "input": {
    "to": "user@example.com",
    "from": "noreply@yourapp.com",
    "subject": "Hello from ToolRoute",
    "html": "<p>This was sent through ToolRoute!</p>"
  }}'

# List available tools
curl https://toolroute.ai/api/v1/tools

# Check your key and balance
curl -H "Authorization: Bearer tr_live_xxx" \\
  https://toolroute.ai/api/v1/key

# Get usage history
curl -H "Authorization: Bearer tr_live_xxx" \\
  "https://toolroute.ai/api/v1/usage?limit=10"`}
        </CodeBlock>

        {/* MCP Integration */}
        <SectionHeading id="mcp-integration">MCP Integration</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          ToolRoute is available as an MCP (Model Context Protocol) server
          for direct integration into Claude Code, AI agents, and other MCP
          clients. The MCP server provides 7 tools for registry operations.
        </p>

        <SubHeading>Add to Claude Code via HTTP</SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-3">
          Add this to your <InlineCode>.mcp.json</InlineCode> for HTTP-based
          MCP access:
        </p>
        <CodeBlock title=".mcp.json">
          {`{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": {
      "Authorization": "Bearer tr_live_xxx"
    }
  }
}`}
        </CodeBlock>

        <SubHeading>Add as stdio MCP server</SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-3">
          If you have the ToolRoute MCP server installed locally:
        </p>
        <CodeBlock title=".mcp.json">
          {`{
  "toolroute": {
    "command": "node",
    "args": ["path/to/toolroute/mcp-server/index.js"],
    "env": {
      "TOOLROUTE_API_KEY": "tr_live_xxx"
    }
  }
}`}
        </CodeBlock>

        <SubHeading>MCP Server Tools</SubHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Tool
                </th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["check_before_build", "Describe what you need, get matching tools and recommendations"],
                ["search_tools", "Search the registry by keyword"],
                ["get_category_champion", "Get the current champion for a category"],
                ["record_usage", "Log tool usage for belief evolution"],
                ["challenge_tool", "Challenge a tool's position with evidence"],
                ["librarian_status", "Get current registry stats and top beliefs"],
                ["log_tool_request", "Log a tool request for discovery tracking"],
              ].map(([tool, desc]) => (
                <tr key={tool} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3">
                    <code className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      {tool}
                    </code>
                  </td>
                  <td className="p-3 text-text-dim">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-border mt-16 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/tools"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Browse the tool registry <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="/openapi.json"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            OpenAPI Spec <ExternalLink className="w-4 h-4" />
          </a>
          <Link
            href="/pricing"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            View pricing plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </article>
    </div>
  );
}
