import type { Metadata } from "next";
import Link from "next/link";
import { Zap, ArrowRight, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation — ToolRoute",
  description:
    "Developer documentation for the ToolRoute API. 40 adapters, 120+ operations. Authentication, endpoints, integration guides.",
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

const categories = [
  { id: "cat-ai", label: "AI & LLM" },
  { id: "cat-search", label: "Search & Web" },
  { id: "cat-voice", label: "Voice & Audio" },
  { id: "cat-email", label: "Email" },
  { id: "cat-image", label: "Image & Media" },
  { id: "cat-video", label: "Video" },
  { id: "cat-content", label: "Content" },
  { id: "cat-business", label: "Business" },
  { id: "cat-data", label: "Data & Analytics" },
  { id: "cat-social", label: "Social & Outreach" },
  { id: "cat-code", label: "Code & DevOps" },
  { id: "cat-productivity", label: "Productivity" },
  { id: "cat-sms", label: "SMS" },
  { id: "cat-meta", label: "Meta" },
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

/* ---------- Compact Tool Card ---------- */
function CompactToolCard({
  slug,
  name,
  description,
  operations,
  pricing,
  byok,
  primaryOp,
  primaryParams,
  curlExample,
}: {
  slug: string;
  name: string;
  description: string;
  operations: string[];
  pricing: string;
  byok: string;
  primaryOp: string;
  primaryParams: Array<{ name: string; type: string; required?: boolean; desc: string }>;
  curlExample: string;
}) {
  return (
    <div
      id={`tool-${slug}`}
      className="border border-border rounded-lg bg-bg-card mb-4 scroll-mt-24"
    >
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold">{name}</h4>
            <span className="text-[10px] text-text-muted bg-bg-card px-2 py-0.5 rounded border border-border">
              {pricing}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${byok === "Yes" ? "text-green bg-green/10" : byok === "BYOK-only" ? "text-yellow bg-yellow/10" : "text-text-muted bg-bg-card border border-border"}`}>
              BYOK: {byok}
            </span>
          </div>
        </div>
        <p className="text-xs text-text-dim mt-1">{description}</p>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {operations.map((op) => (
            <code
              key={op}
              className="text-[11px] text-accent bg-accent/10 px-1.5 py-0.5 rounded"
            >
              {slug}/{op}
            </code>
          ))}
        </div>
        <details className="group">
          <summary className="text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-accent transition-colors">
            {slug}/{primaryOp} -- Parameters &amp; Example
          </summary>
          <div className="mt-2">
            <div className="border border-border rounded-lg mb-2">
              <div className="px-3">
                {primaryParams.map((p) => (
                  <div key={p.name} className="py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <code className="text-xs text-accent bg-accent/10 px-1 py-0.5 rounded">
                        {p.name}
                      </code>
                      <span className="text-[10px] text-text-muted">{p.type}</span>
                      {p.required && (
                        <span className="text-[10px] text-red font-semibold uppercase">
                          required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-dim">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <CodeBlock title="terminal">{curlExample}</CodeBlock>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ---------- Tool data (all 40 adapters) ---------- */
const toolsByCategory = [
  {
    id: "cat-ai",
    title: "AI & LLM",
    tools: [
      {
        slug: "claude",
        name: "Claude (Anthropic)",
        description: "Anthropic Claude LLM -- chat completions via the Messages API.",
        operations: ["chat", "complete"],
        pricing: "$0.003/1K chars",
        byok: "Yes",
        primaryOp: "chat",
        primaryParams: [
          { name: "messages", type: "array", required: true, desc: "Array of {role, content} message objects." },
          { name: "model", type: "string", required: false, desc: "Model ID. Default: claude-sonnet-4-20250514." },
          { name: "max_tokens", type: "number", required: false, desc: "Max response tokens (default: 1024)." },
          { name: "system", type: "string", required: false, desc: "System prompt." },
          { name: "temperature", type: "number", required: false, desc: "Sampling temperature (0-1)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "claude/chat", "input": {
    "messages": [{"role": "user", "content": "Explain REST APIs in 2 sentences."}],
    "max_tokens": 256
  }}'`,
      },
      {
        slug: "openai",
        name: "OpenAI",
        description: "GPT chat completions, DALL-E image generation, text embeddings, and content moderation.",
        operations: ["chat", "image", "embeddings", "moderation"],
        pricing: "$0-$0.04/call",
        byok: "Yes",
        primaryOp: "chat",
        primaryParams: [
          { name: "messages", type: "array", required: true, desc: "Array of {role, content} message objects." },
          { name: "model", type: "string", required: false, desc: "Model ID (default: gpt-4o)." },
          { name: "max_tokens", type: "number", required: false, desc: "Max tokens (default: 1024)." },
          { name: "temperature", type: "number", required: false, desc: "Sampling temperature (default: 0.7)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "openai/chat", "input": {
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "gpt-4o"
  }}'`,
      },
      {
        slug: "replicate",
        name: "Replicate",
        description: "Run any ML model on Replicate -- image generation, LLMs, audio, video.",
        operations: ["run", "list-models"],
        pricing: "$0.01/run",
        byok: "Yes",
        primaryOp: "run",
        primaryParams: [
          { name: "model", type: "string", required: true, desc: 'Model identifier (e.g. "stability-ai/sdxl:version").' },
          { name: "input", type: "object", required: false, desc: "Model-specific input parameters." },
          { name: "version", type: "string", required: false, desc: "Version hash (or append to model with colon)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "replicate/run", "input": {
    "model": "stability-ai/sdxl",
    "input": {"prompt": "a cat astronaut"}
  }}'`,
      },
      {
        slug: "whisper",
        name: "Whisper",
        description: "OpenAI Whisper speech-to-text -- transcribe audio from a URL.",
        operations: ["transcribe"],
        pricing: "$0.01/call",
        byok: "Yes",
        primaryOp: "transcribe",
        primaryParams: [
          { name: "audio_url", type: "string", required: true, desc: "URL to audio file (mp3, wav, etc.)." },
          { name: "model", type: "string", required: false, desc: "Model ID (default: whisper-1)." },
          { name: "language", type: "string", required: false, desc: "ISO language code (e.g. en, es)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "whisper/transcribe", "input": {
    "audio_url": "https://example.com/audio.mp3"
  }}'`,
      },
    ],
  },
  {
    id: "cat-search",
    title: "Search & Web",
    tools: [
      {
        slug: "search",
        name: "Web Search (Brave)",
        description: "Web, news, and image search via Brave Search API.",
        operations: ["web", "news", "images"],
        pricing: "$0.003/call",
        byok: "Yes",
        primaryOp: "web",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Search query." },
          { name: "num_results", type: "number", required: false, desc: "Number of results (default: 10)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "search/web", "input": {"query": "best MCP tools 2026"}}'`,
      },
      {
        slug: "context7",
        name: "Context7",
        description: "Library documentation lookup -- search for libraries and query up-to-date docs.",
        operations: ["search", "query-docs"],
        pricing: "$0.001/call",
        byok: "No",
        primaryOp: "query-docs",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Question about the library." },
          { name: "library", type: "string", required: false, desc: "Library name (e.g. 'next.js')." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "context7/query-docs", "input": {"query": "server actions", "library": "next.js"}}'`,
      },
      {
        slug: "firecrawl",
        name: "Firecrawl",
        description: "Web scraping and crawling -- extract markdown, HTML, or site maps from any URL.",
        operations: ["scrape", "crawl", "map"],
        pricing: "$0.003-$0.01/call",
        byok: "Yes",
        primaryOp: "scrape",
        primaryParams: [
          { name: "url", type: "string", required: true, desc: "URL to scrape." },
          { name: "formats", type: "string[]", required: false, desc: "Output formats (e.g. ['markdown', 'html'])." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "firecrawl/scrape", "input": {"url": "https://example.com"}}'`,
      },
    ],
  },
  {
    id: "cat-voice",
    title: "Voice & Audio",
    tools: [
      {
        slug: "elevenlabs",
        name: "ElevenLabs",
        description: "Text-to-speech -- generate natural-sounding audio from text.",
        operations: ["text-to-speech", "voices"],
        pricing: "$0.0003/char",
        byok: "Yes",
        primaryOp: "text-to-speech",
        primaryParams: [
          { name: "text", type: "string", required: true, desc: "Text to convert to speech." },
          { name: "voice_id", type: "string", required: false, desc: "Voice ID (default: Rachel)." },
          { name: "model_id", type: "string", required: false, desc: "Model (default: eleven_monolingual_v1)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "elevenlabs/text-to-speech", "input": {"text": "Hello from ToolRoute!"}}'`,
      },
      {
        slug: "deepgram",
        name: "Deepgram",
        description: "Speech-to-text transcription -- faster and cheaper than Whisper, supports Nova-3.",
        operations: ["transcribe", "transcribe-url"],
        pricing: "$0.005/call",
        byok: "Yes",
        primaryOp: "transcribe",
        primaryParams: [
          { name: "url", type: "string", required: true, desc: "URL to audio file." },
          { name: "model", type: "string", required: false, desc: "Model (default: nova-3)." },
          { name: "language", type: "string", required: false, desc: "Language code (default: en)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "deepgram/transcribe", "input": {"url": "https://example.com/audio.mp3"}}'`,
      },
      {
        slug: "vapi",
        name: "Vapi",
        description: "Voice AI agents -- create and manage AI phone calls with assistants.",
        operations: ["create-call", "list-calls", "get-call", "list-assistants"],
        pricing: "$0.001-$0.05/call",
        byok: "Yes",
        primaryOp: "create-call",
        primaryParams: [
          { name: "assistant_id", type: "string", required: true, desc: "Vapi assistant ID." },
          { name: "phone_number_id", type: "string", required: false, desc: "Vapi phone number ID." },
          { name: "customer", type: "object", required: false, desc: "Customer object with phone number." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "vapi/create-call", "input": {"assistant_id": "asst_xxx"}}'`,
      },
      {
        slug: "twilio",
        name: "Twilio",
        description: "Send SMS, make voice calls, and list message history.",
        operations: ["send-sms", "make-call", "list-messages"],
        pricing: "$0.001-$0.02/call",
        byok: "Yes",
        primaryOp: "send-sms",
        primaryParams: [
          { name: "to", type: "string", required: true, desc: "Recipient phone number." },
          { name: "from", type: "string", required: true, desc: "Your Twilio phone number." },
          { name: "body", type: "string", required: true, desc: "SMS message body." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "twilio/send-sms", "input": {"to": "+1234567890", "from": "+1987654321", "body": "Hello!"}}'`,
      },
    ],
  },
  {
    id: "cat-email",
    title: "Email",
    tools: [
      {
        slug: "sendgrid",
        name: "SendGrid",
        description: "Deliver transactional and marketing emails.",
        operations: ["send-email"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "send-email",
        primaryParams: [
          { name: "to", type: "string", required: true, desc: "Recipient email." },
          { name: "from", type: "string", required: true, desc: "Sender email (verified in SendGrid)." },
          { name: "subject", type: "string", required: true, desc: "Subject line." },
          { name: "text", type: "string", required: false, desc: "Plain text body." },
          { name: "html", type: "string", required: false, desc: "HTML body." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "sendgrid/send-email", "input": {
    "to": "user@example.com", "from": "noreply@yourapp.com",
    "subject": "Welcome!", "html": "<h1>Welcome</h1>"
  }}'`,
      },
      {
        slug: "resend",
        name: "Resend",
        description: "Modern email delivery with React email support.",
        operations: ["send-email", "list-emails"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "send-email",
        primaryParams: [
          { name: "from", type: "string", required: true, desc: "Sender email." },
          { name: "to", type: "string|string[]", required: true, desc: "Recipient(s)." },
          { name: "subject", type: "string", required: true, desc: "Subject line." },
          { name: "html", type: "string", required: false, desc: "HTML body." },
          { name: "text", type: "string", required: false, desc: "Plain text body." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "resend/send-email", "input": {
    "from": "hi@yourapp.com", "to": "user@example.com",
    "subject": "Hello!", "html": "<p>Hi there</p>"
  }}'`,
      },
    ],
  },
  {
    id: "cat-image",
    title: "Image & Media",
    tools: [
      {
        slug: "image",
        name: "Image Generation (fal.ai)",
        description: "AI image generation and upscaling -- Flux, SDXL, Clarity Upscaler.",
        operations: ["generate", "upscale"],
        pricing: "$0.02-$0.03/call",
        byok: "Yes",
        primaryOp: "generate",
        primaryParams: [
          { name: "prompt", type: "string", required: true, desc: "Image generation prompt." },
          { name: "model", type: "string", required: false, desc: "fal.ai model (default: fal-ai/flux/schnell)." },
          { name: "width", type: "number", required: false, desc: "Image width (default: 1024)." },
          { name: "height", type: "number", required: false, desc: "Image height (default: 1024)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "image/generate", "input": {"prompt": "a futuristic city at sunset"}}'`,
      },
      {
        slug: "pexels",
        name: "Pexels",
        description: "Free stock photos and videos -- search curated high-quality media.",
        operations: ["search-photos", "search-videos", "curated"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "search-photos",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Search query." },
          { name: "per_page", type: "number", required: false, desc: "Results per page (default: 10)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "pexels/search-photos", "input": {"query": "mountains", "per_page": 5}}'`,
      },
      {
        slug: "unsplash",
        name: "Unsplash",
        description: "Free high-resolution stock photos -- search, random, and direct access.",
        operations: ["search", "random", "get-photo"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "search",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Search query." },
          { name: "per_page", type: "number", required: false, desc: "Results per page (default: 10)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "unsplash/search", "input": {"query": "office workspace"}}'`,
      },
      {
        slug: "removebg",
        name: "Remove.bg",
        description: "AI background removal for product photos, headshots, and ad creative.",
        operations: ["remove"],
        pricing: "$0.10/call",
        byok: "Yes",
        primaryOp: "remove",
        primaryParams: [
          { name: "image_url", type: "string", required: false, desc: "URL to image (provide this or image_base64)." },
          { name: "image_base64", type: "string", required: false, desc: "Base64-encoded image." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "removebg/remove", "input": {"image_url": "https://example.com/photo.jpg"}}'`,
      },
      {
        slug: "screenshot",
        name: "Screenshot Capture",
        description: "High-quality website screenshots via ScreenshotOne with thum.io fallback.",
        operations: ["capture", "fullpage"],
        pricing: "$0.005/call",
        byok: "Yes",
        primaryOp: "capture",
        primaryParams: [
          { name: "url", type: "string", required: true, desc: "URL to screenshot." },
          { name: "width", type: "number", required: false, desc: "Viewport width (default: 1280)." },
          { name: "height", type: "number", required: false, desc: "Viewport height (default: 720)." },
          { name: "format", type: "string", required: false, desc: "Output format (default: png)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "screenshot/capture", "input": {"url": "https://example.com"}}'`,
      },
    ],
  },
  {
    id: "cat-video",
    title: "Video",
    tools: [
      {
        slug: "heygen",
        name: "HeyGen",
        description: "AI avatar video generation -- create talking-head videos with AI presenters.",
        operations: ["create-video", "list-avatars", "get-video"],
        pricing: "$0.001-$0.50/call",
        byok: "Yes",
        primaryOp: "create-video",
        primaryParams: [
          { name: "script", type: "string", required: true, desc: "Text the avatar will speak." },
          { name: "avatar_id", type: "string", required: false, desc: "Avatar ID (default: Daisy)." },
          { name: "voice_id", type: "string", required: false, desc: "Voice ID for the avatar." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "heygen/create-video", "input": {"script": "Welcome to our product demo."}}'`,
      },
      {
        slug: "creatomate",
        name: "Creatomate",
        description: "Template-based video and image rendering -- dynamic videos from templates.",
        operations: ["render", "list-templates", "get-render"],
        pricing: "$0.001-$0.50/call",
        byok: "Yes",
        primaryOp: "render",
        primaryParams: [
          { name: "template_id", type: "string", required: true, desc: "Creatomate template ID." },
          { name: "modifications", type: "object", required: false, desc: "Template variable overrides." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "creatomate/render", "input": {"template_id": "tmpl_xxx"}}'`,
      },
      {
        slug: "shotstack",
        name: "Shotstack",
        description: "Video editing and rendering API -- JSON timeline format for programmatic video.",
        operations: ["render", "get-render", "probe"],
        pricing: "$0.001-$0.30/call",
        byok: "Yes",
        primaryOp: "render",
        primaryParams: [
          { name: "timeline", type: "object", required: true, desc: "Shotstack timeline JSON." },
          { name: "output", type: "object", required: false, desc: "Output config (default: mp4 HD)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "shotstack/render", "input": {"timeline": {"tracks": [...]}}}'`,
      },
      {
        slug: "mux",
        name: "Mux",
        description: "Video hosting, streaming, and playback.",
        operations: ["create-asset", "get-asset", "list-assets", "create-playback"],
        pricing: "$0.001-$0.02/call",
        byok: "Yes",
        primaryOp: "create-asset",
        primaryParams: [
          { name: "input_url", type: "string", required: true, desc: "URL to video file." },
          { name: "playback_policy", type: "string", required: false, desc: "Policy: public or signed (default: public)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "mux/create-asset", "input": {"input_url": "https://example.com/video.mp4"}}'`,
      },
    ],
  },
  {
    id: "cat-content",
    title: "Content",
    tools: [
      {
        slug: "translate",
        name: "DeepL Translation",
        description: "High-quality text translation and language detection via DeepL.",
        operations: ["text", "detect-language"],
        pricing: "$0.00005/char",
        byok: "Yes",
        primaryOp: "text",
        primaryParams: [
          { name: "text", type: "string", required: true, desc: "Text to translate." },
          { name: "target_lang", type: "string", required: true, desc: "Target language code (e.g. DE, FR, ES)." },
          { name: "source_lang", type: "string", required: false, desc: "Source language (auto-detected if omitted)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "translate/text", "input": {"text": "Hello world", "target_lang": "ES"}}'`,
      },
      {
        slug: "pdf",
        name: "PDF Generation",
        description: "Generate PDFs from HTML content or URLs via html2pdf.app.",
        operations: ["from-html", "from-url"],
        pricing: "$0.005/call",
        byok: "Yes",
        primaryOp: "from-html",
        primaryParams: [
          { name: "html", type: "string", required: true, desc: "HTML content to convert to PDF." },
          { name: "filename", type: "string", required: false, desc: "Output filename (default: document.pdf)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "pdf/from-html", "input": {"html": "<h1>Invoice</h1><p>Amount: $100</p>"}}'`,
      },
      {
        slug: "playwright",
        name: "Playwright",
        description: "Browser automation -- screenshots, text scraping, and PDF generation.",
        operations: ["screenshot", "scrape-text", "pdf"],
        pricing: "$0.002-$0.005/call",
        byok: "No",
        primaryOp: "scrape-text",
        primaryParams: [
          { name: "url", type: "string", required: true, desc: "URL to extract text from." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "playwright/scrape-text", "input": {"url": "https://example.com"}}'`,
      },
    ],
  },
  {
    id: "cat-business",
    title: "Business",
    tools: [
      {
        slug: "stripe",
        name: "Stripe",
        description: "Payment operations -- list customers, create payment links, list products, check balance.",
        operations: ["list-customers", "create-payment-link", "list-products", "get-balance"],
        pricing: "$0.002/call",
        byok: "Yes",
        primaryOp: "list-customers",
        primaryParams: [
          { name: "limit", type: "number", required: false, desc: "Max customers to return (default: 10)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "stripe/list-customers", "input": {"limit": 5}}'`,
      },
      {
        slug: "apollo",
        name: "Apollo.io",
        description: "Contact enrichment and prospecting -- search people, enrich contacts, find companies.",
        operations: ["search-people", "enrich", "search-companies"],
        pricing: "$0.01-$0.03/call",
        byok: "Yes",
        primaryOp: "search-people",
        primaryParams: [
          { name: "person_titles", type: "string[]", required: false, desc: "Job titles to search (e.g. ['CEO', 'CTO'])." },
          { name: "q_organization_name", type: "string", required: false, desc: "Company name filter." },
          { name: "per_page", type: "number", required: false, desc: "Results per page." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "apollo/search-people", "input": {"person_titles": ["CEO"], "per_page": 5}}'`,
      },
      {
        slug: "creatify",
        name: "Creatify",
        description: "AI ad generation -- create video ads from product URLs with AI avatars.",
        operations: ["create-ad", "list-ads", "get-ad"],
        pricing: "$0.001-$2.00/call",
        byok: "Yes",
        primaryOp: "create-ad",
        primaryParams: [
          { name: "url", type: "string", required: true, desc: "Product page URL." },
          { name: "ad_format", type: "string", required: false, desc: "Ad format type." },
          { name: "duration", type: "number", required: false, desc: "Ad duration in seconds." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "creatify/create-ad", "input": {"url": "https://myproduct.com"}}'`,
      },
      {
        slug: "shippo",
        name: "Shippo",
        description: "Shipping labels and tracking -- create shipments, get rates, print labels, track packages.",
        operations: ["create-shipment", "get-rates", "create-label", "track"],
        pricing: "$0.001-$0.05/call",
        byok: "Yes",
        primaryOp: "create-shipment",
        primaryParams: [
          { name: "address_from", type: "object", required: true, desc: "Sender address object." },
          { name: "address_to", type: "object", required: true, desc: "Recipient address object." },
          { name: "parcels", type: "object[]", required: true, desc: "Array of parcel objects (length, width, height, weight)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "shippo/create-shipment", "input": {
    "address_from": {"name": "Sender", "street1": "123 Main", "city": "SF", "state": "CA", "zip": "94102", "country": "US"},
    "address_to": {"name": "Recipient", "street1": "456 Oak", "city": "LA", "state": "CA", "zip": "90001", "country": "US"},
    "parcels": [{"length": "10", "width": "8", "height": "4", "weight": "2", "mass_unit": "lb", "distance_unit": "in"}]
  }}'`,
      },
    ],
  },
  {
    id: "cat-data",
    title: "Data & Analytics",
    tools: [
      {
        slug: "supabase",
        name: "Supabase",
        description: "Database operations -- execute SQL, list tables, insert and select rows.",
        operations: ["execute-sql", "list-tables", "insert", "select"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "execute-sql",
        primaryParams: [
          { name: "project_ref", type: "string", required: true, desc: "Supabase project reference ID." },
          { name: "sql", type: "string", required: true, desc: "SQL query to execute." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "supabase/execute-sql", "input": {"project_ref": "abcdefghijkl", "sql": "SELECT count(*) FROM users"}}'`,
      },
      {
        slug: "sentry",
        name: "Sentry",
        description: "Error tracking and performance monitoring -- list issues, get details, view events.",
        operations: ["list-issues", "get-issue", "list-events"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "list-issues",
        primaryParams: [
          { name: "organization", type: "string", required: true, desc: "Sentry organization slug." },
          { name: "project", type: "string", required: true, desc: "Sentry project slug." },
          { name: "query", type: "string", required: false, desc: "Search query (default: is:unresolved)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "sentry/list-issues", "input": {"organization": "my-org", "project": "my-app"}}'`,
      },
      {
        slug: "dataforseo",
        name: "DataForSEO",
        description: "SEO data -- SERP results, keyword volumes, backlinks at $0.0006/query.",
        operations: ["serp", "keywords", "backlinks"],
        pricing: "$0.002/call",
        byok: "Yes",
        primaryOp: "serp",
        primaryParams: [
          { name: "keyword", type: "string", required: true, desc: "Search keyword." },
          { name: "location_name", type: "string", required: false, desc: "Location (default: United States)." },
          { name: "language_name", type: "string", required: false, desc: "Language (default: English)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "dataforseo/serp", "input": {"keyword": "best crm software"}}'`,
      },
    ],
  },
  {
    id: "cat-social",
    title: "Social & Outreach",
    tools: [
      {
        slug: "postiz",
        name: "Postiz",
        description: "Social media posting -- schedule and publish to Twitter, LinkedIn, and more.",
        operations: ["create-post", "list-posts", "get-integrations"],
        pricing: "$0.001-$0.002/call",
        byok: "Yes",
        primaryOp: "create-post",
        primaryParams: [
          { name: "content", type: "string", required: true, desc: "Post content text." },
          { name: "platforms", type: "string[]", required: false, desc: "Target platforms." },
          { name: "media_url", type: "string", required: false, desc: "Media attachment URL." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "postiz/create-post", "input": {"content": "Check out our new API!"}}'`,
      },
      {
        slug: "outscraper",
        name: "Outscraper",
        description: "Data scraping -- Google Maps places, reviews, and email/contact extraction.",
        operations: ["google-maps", "google-reviews", "emails-and-contacts"],
        pricing: "$0.005-$0.01/call",
        byok: "Yes",
        primaryOp: "google-maps",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Search query (e.g. 'restaurants in Miami')." },
          { name: "limit", type: "number", required: false, desc: "Max results (default: 20)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "outscraper/google-maps", "input": {"query": "dentists in Miami", "limit": 10}}'`,
      },
    ],
  },
  {
    id: "cat-code",
    title: "Code & DevOps",
    tools: [
      {
        slug: "github",
        name: "GitHub",
        description: "GitHub API -- search repos, read READMEs, and list issues.",
        operations: ["search-repos", "get-readme", "list-issues"],
        pricing: "$0.001/call",
        byok: "Yes",
        primaryOp: "search-repos",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Search query (GitHub search syntax)." },
          { name: "per_page", type: "number", required: false, desc: "Results per page (default: 10)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "github/search-repos", "input": {"query": "mcp server typescript", "per_page": 5}}'`,
      },
    ],
  },
  {
    id: "cat-productivity",
    title: "Productivity",
    tools: [
      {
        slug: "calendar",
        name: "Google Calendar",
        description: "List events, create events, check availability. Requires Google OAuth token via BYOK.",
        operations: ["list-events", "create-event", "check-availability"],
        pricing: "$0.001/call",
        byok: "BYOK-only",
        primaryOp: "list-events",
        primaryParams: [
          { name: "calendar_id", type: "string", required: false, desc: "Calendar ID (default: primary)." },
          { name: "max_results", type: "number", required: false, desc: "Max events (default: 10)." },
          { name: "time_min", type: "string", required: false, desc: "Start time ISO string." },
          { name: "time_max", type: "string", required: false, desc: "End time ISO string." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "calendar/list-events", "input": {"max_results": 5}}'`,
      },
      {
        slug: "drive",
        name: "Google Drive",
        description: "File management -- list, search, read, and upload files. Requires Google OAuth via BYOK.",
        operations: ["list-files", "search", "get-content", "upload-text"],
        pricing: "$0.001/call",
        byok: "BYOK-only",
        primaryOp: "search",
        primaryParams: [
          { name: "query", type: "string", required: true, desc: "Search query for file content." },
          { name: "page_size", type: "number", required: false, desc: "Results per page (default: 20)." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "drive/search", "input": {"query": "quarterly report"}}'`,
      },
    ],
  },
  {
    id: "cat-sms",
    title: "SMS",
    tools: [
      {
        slug: "textbelt",
        name: "Textbelt",
        description: "Simple cheap SMS sending and delivery status checking.",
        operations: ["send-sms", "check-status"],
        pricing: "$0-$0.005/call",
        byok: "Yes",
        primaryOp: "send-sms",
        primaryParams: [
          { name: "phone", type: "string", required: true, desc: "Recipient phone number." },
          { name: "message", type: "string", required: true, desc: "SMS message text." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "textbelt/send-sms", "input": {"phone": "+1234567890", "message": "Your order shipped!"}}'`,
      },
    ],
  },
  {
    id: "cat-meta",
    title: "Meta",
    tools: [
      {
        slug: "toolroute",
        name: "ToolRoute Registry",
        description: "Query the capability registry -- check what tools exist before building.",
        operations: ["check_before_build", "search"],
        pricing: "$0.0005-$0.001/call",
        byok: "No",
        primaryOp: "check_before_build",
        primaryParams: [
          { name: "task", type: "string", required: true, desc: "Natural language description of what you want to build." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "toolroute/check_before_build", "input": {"task": "I need to send transactional emails"}}'`,
      },
      {
        slug: "auto",
        name: "Auto-Router",
        description: "Describe your task in natural language -- ToolRoute picks the best tool and executes it.",
        operations: ["route"],
        pricing: "Varies (same as routed tool)",
        byok: "No",
        primaryOp: "route",
        primaryParams: [
          { name: "task", type: "string", required: true, desc: "Natural language task description." },
        ],
        curlExample: `curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "auto/route", "input": {"task": "scrape example.com and get the text"}}'`,
      },
    ],
  },
];

/* Count totals */
const totalAdapters = toolsByCategory.reduce((sum, cat) => sum + cat.tools.length, 0);
const totalOperations = toolsByCategory.reduce(
  (sum, cat) => sum + cat.tools.reduce((s, t) => s + t.operations.length, 0),
  0
);

/* Flat tools list for sidebar and summary table */
const allTools = toolsByCategory.flatMap((cat) => cat.tools);

/* Summary table rows */
const summaryRows = allTools.map((t) => [
  t.slug,
  t.operations.join(", "),
  t.byok,
  t.pricing,
]);

/* ---------- Page ---------- */
export default function DocsPage() {
  return (
    <div className="flex gap-8 pb-16">
      {/* Sidebar TOC */}
      <aside className="hidden lg:block w-56 shrink-0">
        <nav className="sticky top-20 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
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
              Categories
            </p>
            {categories.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="block text-xs text-text-dim hover:text-accent transition-colors py-0.5 border-l-2 border-transparent hover:border-accent pl-3"
              >
                {label}
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
            scripts, and applications. One API key, {totalAdapters} gateway adapters, {totalOperations}+ operations.
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

        {/* API Reference */}
        <SectionHeading id="api-reference">API Reference</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-6">
          Base URL: <InlineCode>https://toolroute.ai/api/v1</InlineCode>
        </p>

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
              Tool-specific input parameters. See each tool&apos;s documentation below.
            </Param>
          </div>
        </div>

        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/tools
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          List all available tools with pricing. No auth required.
        </p>

        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/key
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Get API key info and remaining credits.
        </p>

        <SubHeading>
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded mr-2">
            GET
          </span>
          /api/v1/usage
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Usage history with filtering by tool and date.
        </p>

        <SubHeading>
          <span className="inline-block bg-green/10 text-green text-xs font-bold px-2 py-0.5 rounded mr-2">
            POST
          </span>
          /api/v1/checkout
        </SubHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Create a Stripe checkout session to add credits. Minimum $5.
        </p>

        {/* Auto-Routing */}
        <SectionHeading id="auto-routing">Auto-Routing</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          Don&apos;t know which tool to use? Two approaches:
        </p>
        <div className="space-y-4 mb-4">
          <div className="border border-border rounded-lg p-4 bg-bg-card">
            <p className="text-sm font-semibold mb-1">
              <InlineCode>toolroute/check_before_build</InlineCode> -- Search only
            </p>
            <p className="text-xs text-text-dim">
              Describe your task and get matching tools, composites, and category beliefs ranked by confidence. Does not execute anything.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-bg-card">
            <p className="text-sm font-semibold mb-1">
              <InlineCode>auto/route</InlineCode> -- Search + Execute
            </p>
            <p className="text-xs text-text-dim">
              Describe your task, ToolRoute picks the best tool and executes it automatically. Returns routing metadata alongside results.
            </p>
          </div>
        </div>
        <CodeBlock title="Auto-route request">
          {`curl -X POST https://toolroute.ai/api/v1/execute \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "auto/route", "input": {"task": "scrape example.com and get the text"}}'`}
        </CodeBlock>

        {/* Available Tools */}
        <SectionHeading id="available-tools">Available Tools</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          {totalAdapters} gateway adapters with {totalOperations}+ operations across 14 categories.
          Each operation is accessed via{" "}
          <InlineCode>POST /api/v1/execute</InlineCode> with the tool ID in{" "}
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
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider hidden sm:table-cell">
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
              {summaryRows.map(([adapter, ops, byok, pricing]) => (
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
                  <td className="p-3 text-text-dim font-mono text-xs hidden sm:table-cell">{ops}</td>
                  <td className="p-3 text-text-dim text-xs">{byok}</td>
                  <td className="p-3 text-text-dim text-xs">{pricing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tool cards by category */}
        {toolsByCategory.map((cat) => (
          <div key={cat.id}>
            <SubHeading id={cat.id}>{cat.title}</SubHeading>
            {cat.tools.map((tool) => (
              <CompactToolCard key={tool.slug} {...tool} />
            ))}
          </div>
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
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Code</th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["invalid_request", "400", "Missing fields or bad input"],
                ["authentication_required", "401", "No API key provided"],
                ["invalid_api_key", "401", "Key not found or revoked"],
                ["insufficient_balance", "402", "No credits remaining"],
                ["tool_not_found", "404", "Tool identifier not in registry"],
                ["rate_limit_exceeded", "429", "Too many requests"],
                ["adapter_error", "500", "Upstream provider error"],
              ].map(([code, status, desc]) => (
                <tr key={code} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3">
                    <code className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">{code}</code>
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
          Register your own API keys for supported providers. Requests route through your key with zero markup. Keys are encrypted at rest with AES-256.
        </p>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          <strong className="text-text">BYOK-supported adapters:</strong> claude, openai, replicate, whisper, search (Brave), firecrawl, elevenlabs, deepgram, vapi, twilio, sendgrid, resend, image (fal.ai), pexels, unsplash, removebg, screenshot, heygen, creatomate, shotstack, mux, translate (DeepL), pdf, stripe, apollo, creatify, shippo, supabase, sentry, dataforseo, postiz, outscraper, github, textbelt.
        </p>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          <strong className="text-text">BYOK-only adapters</strong> (no pooled key): calendar (Google Calendar), drive (Google Drive).
        </p>
        <CodeBlock title="Register a BYOK key">
          {`curl -X POST https://toolroute.ai/api/v1/provider-keys \\
  -H "Authorization: Bearer tr_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"provider": "elevenlabs", "api_key": "your-elevenlabs-key-here"}'`}
        </CodeBlock>

        {/* Rate Limits */}
        <SectionHeading id="rate-limits">Rate Limits</SectionHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Plan</th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">RPM</th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Daily / Monthly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr><td className="p-3 text-text">Free</td><td className="p-3 text-text-dim">10</td><td className="p-3 text-text-dim">100/day</td></tr>
              <tr><td className="p-3 text-accent font-medium">Pro</td><td className="p-3 text-text-dim">60</td><td className="p-3 text-text-dim">10,000/month</td></tr>
              <tr><td className="p-3 text-text">Enterprise</td><td className="p-3 text-text-dim">300</td><td className="p-3 text-text-dim">100,000/month</td></tr>
            </tbody>
          </table>
        </div>

        {/* SDKs */}
        <SectionHeading id="sdks">SDKs</SectionHeading>
        <SubHeading>Python</SubHeading>
        <CodeBlock lang="python">
          {`import requests

def toolroute(tool: str, input: dict) -> dict:
    r = requests.post(
        "https://toolroute.ai/api/v1/execute",
        headers={"Authorization": "Bearer tr_live_xxx"},
        json={"tool": tool, "input": input},
    )
    r.raise_for_status()
    return r.json()

result = toolroute("firecrawl/scrape", {"url": "https://example.com"})
audio = toolroute("elevenlabs/text-to-speech", {"text": "Hello!"})
repos = toolroute("github/search-repos", {"query": "mcp tools"})`}
        </CodeBlock>

        <SubHeading>JavaScript / TypeScript</SubHeading>
        <CodeBlock lang="typescript">
          {`async function toolroute(tool: string, input: Record<string, unknown>) {
  const res = await fetch("https://toolroute.ai/api/v1/execute", {
    method: "POST",
    headers: {
      "Authorization": "Bearer tr_live_xxx",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, input }),
  });
  if (!res.ok) throw new Error(\`ToolRoute error: \${res.status}\`);
  return res.json();
}

const page = await toolroute("firecrawl/scrape", { url: "https://example.com" });
const chat = await toolroute("claude/chat", {
  messages: [{ role: "user", content: "Hello!" }],
});`}
        </CodeBlock>

        {/* MCP Integration */}
        <SectionHeading id="mcp-integration">MCP Integration</SectionHeading>
        <p className="text-text-dim text-sm leading-relaxed mb-4">
          ToolRoute is available as an MCP server for direct integration into Claude Code and other MCP clients.
        </p>
        <CodeBlock title=".mcp.json (HTTP)">
          {`{
  "toolroute": {
    "type": "http",
    "url": "https://toolroute.ai/mcp",
    "headers": { "Authorization": "Bearer tr_live_xxx" }
  }
}`}
        </CodeBlock>

        <SubHeading>MCP Server Tools</SubHeading>
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Tool</th>
                <th className="text-left p-3 text-text-muted text-xs font-medium uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["check_before_build", "Describe what you need, get matching tools"],
                ["search_tools", "Search the registry by keyword"],
                ["get_category_champion", "Get the champion for a category"],
                ["record_usage", "Log tool usage for belief evolution"],
                ["challenge_tool", "Challenge a tool's position with evidence"],
                ["librarian_status", "Registry stats and top beliefs"],
                ["log_tool_request", "Log a tool request for discovery tracking"],
              ].map(([tool, desc]) => (
                <tr key={tool} className="hover:bg-bg-card-hover transition-colors">
                  <td className="p-3">
                    <code className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">{tool}</code>
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
            href="/llms-full.txt"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Full API Reference (llms-full.txt) <ExternalLink className="w-4 h-4" />
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
