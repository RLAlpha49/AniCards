import { afterEach, describe, expect, it, mock } from "bun:test";
import { fetchWithRetry } from "@/hooks/useStatCardSubmit";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("stat card requests", () => {
  it("returns non-retryable responses to the caller", async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 400 })) as unknown as typeof fetch;
    const response = await fetchWithRetry("/test", {}, { maxRetries: 0 });
    expect(response.status).toBe(400);
  });

  it("reports a retryable failure when no retries remain", async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    await expect(
      fetchWithRetry("/test", {}, { maxRetries: 0, operationName: "Store" }),
    ).rejects.toThrow("Store failed: HTTP status 503");
  });
});