import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { requestClientJson } from "@/lib/api/client-fetch";

const originalFetch = globalThis.fetch;

describe("lib/api/client-fetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("parses JSON payloads for successful requests", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
    ) as unknown as typeof fetch;

    const result = await requestClientJson("/api/test");

    expect(result.response.status).toBe(200);
    expect(result.payload).toEqual({ ok: true });
  });

  it("aborts the fetch when the client timeout elapses", async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = mock(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          capturedSignal = init?.signal ?? undefined;
          capturedSignal?.addEventListener(
            "abort",
            () => {
              reject(
                capturedSignal?.reason ??
                  new DOMException("The request was aborted.", "AbortError"),
              );
            },
            { once: true },
          );
        }),
    ) as unknown as typeof fetch;

    const requestPromise = requestClientJson("/api/test", { timeoutMs: 500 });

    vi.advanceTimersByTime(500);

    await expect(requestPromise).rejects.toMatchObject({
      name: "TimeoutError",
    });
    expect(capturedSignal?.aborted).toBe(true);
  });
});
