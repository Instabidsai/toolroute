"""ToolRoute Python SDK — One API key. Every tool."""

import requests

class ToolRoute:
    BASE_URL = "https://toolroute.ai/api/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

    def execute(self, tool: str, input: dict, **kwargs) -> dict:
        """Execute any tool. e.g., tr.execute("search/web", {"query": "AI tools"}).

        Premium providers (claude, image, translate, search/web, elevenlabs, resend, stripe,
        context7, etc.) require BYOK — register your provider key at /api/v1/byok and
        ToolRoute routes at zero markup.
        """
        body = {"tool": tool, "input": input}
        if kwargs:
            body["provider"] = kwargs
        resp = self.session.post(f"{self.BASE_URL}/execute", json=body)
        resp.raise_for_status()
        return resp.json()

    def search(self, query: str, num_results: int = 5) -> dict:
        """Web search shortcut. BYOK required (premium provider)."""
        return self.execute("search/web", {"query": query, "num_results": num_results})

    def chat(self, message: str, model: str = "claude-sonnet-4-20250514") -> dict:
        """LLM chat shortcut. BYOK required — Anthropic ToS forbids resale."""
        return self.execute("claude/chat", {"messages": [{"role": "user", "content": message}], "model": model})

    def scrape(self, url: str) -> dict:
        """Web scrape shortcut."""
        return self.execute("firecrawl/scrape", {"url": url})

    def translate(self, text: str, target_lang: str) -> dict:
        """Translation shortcut. BYOK required (premium provider)."""
        return self.execute("translate/text", {"text": text, "target_lang": target_lang})

    def generate_image(self, prompt: str) -> dict:
        """Image generation shortcut. BYOK required (premium provider)."""
        return self.execute("image/generate", {"prompt": prompt})

    def tts(self, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> dict:
        """Text-to-speech shortcut. BYOK required (premium provider)."""
        return self.execute("elevenlabs/text-to-speech", {"text": text, "voice_id": voice_id})

    def auto(self, task: str) -> dict:
        """Auto-route: describe what you need, we pick the best tool."""
        return self.execute("auto/route", {"task": task})

    def balance(self) -> dict:
        """Check API key balance and usage."""
        resp = self.session.get(f"{self.BASE_URL}/key")
        resp.raise_for_status()
        return resp.json()

    def tools(self) -> dict:
        """List all available tools."""
        resp = self.session.get(f"{self.BASE_URL}/tools")
        resp.raise_for_status()
        return resp.json()
