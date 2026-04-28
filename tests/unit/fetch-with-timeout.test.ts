import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchWithTimeout,
  FetchTimeoutError,
} from "@/lib/fetch-with-timeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the response when fetch resolves before timeout", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse);

    const res = await fetchWithTimeout("https://example.com/healthy", {
      timeoutMs: 1000,
    });

    expect(res).toBe(mockResponse);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs[1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it("throws FetchTimeoutError with the URL + ms when timeout fires", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => {
          const e = new DOMException("aborted", "AbortError");
          reject(e);
        });
      });
    });

    const url = "https://example.com/slow";
    await expect(
      fetchWithTimeout(url, { timeoutMs: 10 })
    ).rejects.toMatchObject({
      name: "FetchTimeoutError",
      url,
      timeoutMs: 10,
    });
  });

  it("propagates non-abort errors verbatim", async () => {
    const networkErr = new Error("ECONNREFUSED");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(networkErr);

    await expect(
      fetchWithTimeout("https://example.com/down", { timeoutMs: 1000 })
    ).rejects.toBe(networkErr);
  });

  it("respects a caller-supplied signal that is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    await expect(
      fetchWithTimeout("https://example.com/preaborted", {
        signal: controller.signal,
        timeoutMs: 60_000,
      })
    ).rejects.toBeInstanceOf(FetchTimeoutError);
  });

  it("FetchTimeoutError exposes a clear message", () => {
    const err = new FetchTimeoutError("https://api.example.com/x", 30_000);
    expect(err.message).toContain("30000ms");
    expect(err.message).toContain("https://api.example.com/x");
    expect(err.name).toBe("FetchTimeoutError");
  });
});
