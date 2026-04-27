import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report Abuse | ToolRoute",
  description:
    "Report abusive, unsafe, or policy-violating use of ToolRoute tools and API keys.",
};

const errorCopy: Record<string, string> = {
  invalid_body: "The report could not be read. Please try again.",
  invalid_contact_email: "Enter a valid contact email or leave it blank.",
  description_required: "Please include at least 20 characters of detail.",
  description_too_long: "Please keep the report under 5,000 characters.",
  invalid_evidence_url: "Evidence URL must start with http:// or https://.",
  rate_limited: "Too many reports were submitted from this network. Try again later.",
  email_failed: "The report could not be delivered. Email support@toolroute.ai directly.",
};

export default async function AbusePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errorCopy[params.error] : null;

  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-accent font-semibold mb-3">
          Trust and safety
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Report abuse</h1>
        <p className="text-text-dim leading-relaxed">
          Use this form to report policy violations, spam, suspicious tool
          usage, harmful automation, or API key misuse involving ToolRoute.
          Reports go to the ToolRoute operations inbox for review.
        </p>
      </div>

      {params.sent === "1" && (
        <div className="border border-green/30 bg-green/10 text-green rounded-lg px-4 py-3 text-sm mb-6">
          Abuse report received.
        </div>
      )}

      {error && (
        <div className="border border-red/30 bg-red/10 text-red rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      <form
        action="/api/v1/abuse"
        method="post"
        className="border border-border rounded-lg bg-bg-card p-6 space-y-5"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium mb-2">Contact email</span>
            <input
              name="contact_email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-2">Report type</span>
            <select
              name="report_type"
              className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              defaultValue="abuse"
            >
              <option value="abuse">Abuse or harassment</option>
              <option value="spam">Spam or scraping</option>
              <option value="security">Security concern</option>
              <option value="policy">Policy violation</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium mb-2">
            Tool, API key prefix, request ID, or URL
          </span>
          <input
            name="target"
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="tr_live_abcd..., /api/v1/execute, or a public URL"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-2">Evidence URL</span>
          <input
            name="evidence_url"
            type="url"
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="https://example.com/evidence"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-2">Description</span>
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={5000}
            rows={8}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Describe what happened and why it appears abusive or unsafe."
          />
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          Submit report
        </button>
      </form>
    </div>
  );
}
