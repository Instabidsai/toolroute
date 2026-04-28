// Wraps native fetch with an AbortController-driven timeout. Without this,
// a hung upstream (LLM provider, polling video service, slow webhook target)
// holds the Vercel function until the platform's 300s execution ceiling —
// burning concurrency and, combined with the credit-deduct flow, exposing
// us to "function killed mid-execute, customer charged but never deducted"
// failure modes.

const DEFAULT_TIMEOUT_MS = 60_000;

export class FetchTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;
  constructor(url: string, timeoutMs: number) {
    super(`Upstream request timed out after ${timeoutMs}ms: ${url}`);
    this.name = "FetchTimeoutError";
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...rest
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Compose caller's signal with our timeout so external aborts still work.
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new FetchTimeoutError(String(input), timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
