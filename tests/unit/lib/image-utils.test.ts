import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { sharedRedisMockGet, sharedRedisMockSet } from "@/tests/unit/__setup__";

const { clearImageDataUrlCaches, fetchImageAsDataUrl } =
  await import("@/lib/image-utils");

describe("image-utils shared asset cache", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearImageDataUrlCaches();
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearImageDataUrlCaches();
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
  });

  it("reads a fresh shared cache entry before fetching the remote asset", async () => {
    const imageUrl = "https://s4.anilist.co/file/anilistcdn/staff/1.jpg";
    const cachedDataUrl = "data:image/png;base64,shared-cache";

    sharedRedisMockGet.mockResolvedValueOnce(
      JSON.stringify({
        dataUrl: cachedDataUrl,
        expiresAt: Date.now() + 60_000,
      }),
    );

    const fetchMock = mock(async () => {
      throw new Error("remote fetch should not run when shared cache hits");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchImageAsDataUrl(imageUrl);

    expect(result).toBe(cachedDataUrl);
    expect(sharedRedisMockGet).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dedupes concurrent fetches and persists the transformed asset to shared cache", async () => {
    const imageUrl = "https://s4.anilist.co/file/anilistcdn/staff/2.jpg";

    sharedRedisMockGet.mockResolvedValueOnce(null);

    const fetchMock = mock().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const [firstResult, secondResult] = await Promise.all([
      fetchImageAsDataUrl(imageUrl),
      fetchImageAsDataUrl(imageUrl),
    ]);

    expect(firstResult).toBeTruthy();
    expect(secondResult).toBe(firstResult);
    expect(sharedRedisMockGet).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockSet).toHaveBeenCalledTimes(1);

    const [cacheKey, serializedEntry] = sharedRedisMockSet.mock.calls[0] as [
      string,
      string,
    ];
    expect(cacheKey).toContain("image-data-url:v1:");
    expect(JSON.parse(serializedEntry)).toMatchObject({
      dataUrl: firstResult,
    });
  });
});
