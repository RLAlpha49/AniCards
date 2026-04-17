import "@/tests/unit/__setup__";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

async function importRealCardsModule() {
  return await import("../../../../lib/api/cards");
}

const originalConsoleError = console.error;
const originalFetch = globalThis.fetch;

describe("lib/api/cards", () => {
  beforeEach(() => {
    console.error = mock(() => undefined) as typeof console.error;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
  });

  it("normalizes successful card payloads including string user ids and deduped card order", async () => {
    const { fetchUserCards } = await importRealCardsModule();
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            userId: "42",
            cards: [
              {
                cardName: "animeStats",
                variation: "minimal",
              },
            ],
            cardOrder: [" animeStats ", "animeStats", "profileOverview", ""],
            globalSettings: {
              colorPreset: "default",
              borderEnabled: true,
            },
            updatedAt: "2026-04-16T00:00:00.000Z",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
    ) as unknown as typeof fetch;

    const result = await fetchUserCards("42");

    expect(result).toEqual({
      userId: 42,
      cards: [
        {
          cardName: "animeStats",
          variation: "minimal",
        },
      ],
      cardOrder: ["animeStats", "profileOverview"],
      globalSettings: {
        colorPreset: "default",
        borderEnabled: true,
      },
      updatedAt: "2026-04-16T00:00:00.000Z",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/get-cards?userId=42",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns a structured invalid-data error when the response payload shape is malformed", async () => {
    const { fetchUserCards } = await importRealCardsModule();
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            userId: "forty-two",
            cards: "not-an-array",
            updatedAt: "",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
    ) as unknown as typeof fetch;

    const result = await fetchUserCards("42");

    expect(result).toEqual({
      error: expect.objectContaining({
        category: "invalid_data",
        message: "Invalid cards data received",
        retryable: false,
        status: undefined,
      }),
    });
  });

  it("preserves 404 card responses as notFound errors", async () => {
    const { fetchUserCards } = await importRealCardsModule();
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: "Cards not found" }), {
          headers: { "Content-Type": "application/json" },
          status: 404,
        }),
    ) as unknown as typeof fetch;

    const result = await fetchUserCards("42");

    expect(result).toEqual({
      error: expect.objectContaining({
        message: "Cards not found",
        status: 404,
      }),
      notFound: true,
    });
  });

  it("maps timeout failures to a retryable timeout error without rethrowing", async () => {
    const { fetchUserCards } = await importRealCardsModule();
    const timeoutError = new DOMException(
      "Request timed out after 15000ms",
      "TimeoutError",
    );

    globalThis.fetch = mock(async () => {
      throw timeoutError;
    }) as unknown as typeof fetch;

    const result = await fetchUserCards("42");

    expect(result).toEqual({
      error: expect.objectContaining({
        message: "Loading your cards timed out. Please try again.",
      }),
    });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("rethrows cancelled requests so callers can ignore stale responses", async () => {
    const { fetchUserCards } = await importRealCardsModule();
    const controller = new AbortController();
    const abortError = new DOMException(
      "The request was aborted.",
      "AbortError",
    );
    controller.abort(abortError);

    await expect(
      fetchUserCards("42", { signal: controller.signal }),
    ).rejects.toBe(abortError);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("maps unexpected failures to the generic connection error response", async () => {
    const { fetchUserCards } = await importRealCardsModule();
    const networkError = new Error("socket hang up");
    globalThis.fetch = mock(async () => {
      throw networkError;
    }) as unknown as typeof fetch;

    const result = await fetchUserCards("42");

    expect(result).toEqual({
      error: expect.objectContaining({
        category: "network_error",
        message:
          "Failed to fetch cards. Please check your connection and try again.",
        retryable: true,
      }),
    });
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
