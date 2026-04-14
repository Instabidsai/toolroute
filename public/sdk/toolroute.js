/**
 * ToolRoute JavaScript SDK — One API key. Every tool.
 * Usage: const tr = new ToolRoute("tr_live_xxx");
 */
class ToolRoute {
  constructor(apiKey, baseUrl = "https://toolroute.ai/api/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async execute(tool, input, provider) {
    const body = { tool, input };
    if (provider) body.provider = provider;
    const res = await fetch(`${this.baseUrl}/execute`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Shortcuts
  search(query, numResults = 5) { return this.execute("search/web", { query, num_results: numResults }); }
  chat(message, model = "claude-sonnet-4-20250514") { return this.execute("claude/chat", { messages: [{ role: "user", content: message }], model }); }
  scrape(url) { return this.execute("firecrawl/scrape", { url }); }
  translate(text, targetLang) { return this.execute("translate/text", { text, target_lang: targetLang }); }
  generateImage(prompt) { return this.execute("image/generate", { prompt }); }
  tts(text) { return this.execute("elevenlabs/text-to-speech", { text }); }
  auto(task) { return this.execute("auto/route", { task }); }

  async balance() {
    const res = await fetch(`${this.baseUrl}/key`, {
      headers: { "Authorization": `Bearer ${this.apiKey}` }
    });
    return res.json();
  }

  async tools() {
    const res = await fetch(`${this.baseUrl}/tools`);
    return res.json();
  }
}

if (typeof module !== "undefined") module.exports = { ToolRoute };
