import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { sharedRedisMockGet, sharedRedisMockSet } from "@/tests/unit/__setup__";

const {
  clearImageDataUrlCaches,
  embedFavoritesGridImages,
  embedMediaListCoverImages,
  fetchImageAsDataUrl,
  getImageDataUrlMemoryCacheSizeBytes,
  IMAGE_DATA_URL_MEMORY_CACHE_MAX_BYTES,
  IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES,
  IMAGE_DATA_URL_SHARED_CACHE_MAX_BYTES,
  imageDataUrlCache,
} = await import("@/lib/image-utils");

function createSizedDataUrl(targetBytes: number): string {
  const prefix = "data:image/png;base64,";
  const prefixBytes = Buffer.byteLength(prefix, "utf8");
  const payloadBytes = Math.max(0, targetBytes - prefixBytes);
  return `${prefix}${"A".repeat(payloadBytes)}`;
}

async function flushMicrotasks(turns = 12): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
}

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

  it("refreshes in-memory cache recency on hits before evicting the least recently used entry", async () => {
    const expiresAt = Date.now() + 60_000;
    const makeImageUrl = (index: number) =>
      `https://s4.anilist.co/file/anilistcdn/staff/lru-${index}.jpg`;

    for (
      let index = 0;
      index < IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES;
      index += 1
    ) {
      const dataUrl = `data:image/png;base64,${index}`;
      imageDataUrlCache.set(makeImageUrl(index), {
        dataUrl,
        expiresAt,
        byteLength: Buffer.byteLength(dataUrl, "utf8"),
      });
    }

    const refreshedUrl = makeImageUrl(0);
    const evictedUrl = makeImageUrl(1);
    const insertedUrl = makeImageUrl(IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES);

    const fetchMock = mock().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const cachedResult = await fetchImageAsDataUrl(refreshedUrl);
    const insertedResult = await fetchImageAsDataUrl(insertedUrl);

    expect(cachedResult).toBe("data:image/png;base64,0");
    expect(insertedResult).toBeTruthy();
    expect(imageDataUrlCache.size).toBe(
      IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES,
    );
    expect(imageDataUrlCache.has(refreshedUrl)).toBe(true);
    expect(imageDataUrlCache.has(evictedUrl)).toBe(false);
    expect(imageDataUrlCache.has(insertedUrl)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces the in-memory byte budget even when the entry cap is not reached", async () => {
    const expiresAt = Date.now() + 60_000;
    const largeEntryBytes =
      Math.floor(IMAGE_DATA_URL_MEMORY_CACHE_MAX_BYTES / 2) - 64;
    const firstUrl =
      "https://s4.anilist.co/file/anilistcdn/staff/byte-budget-1.jpg";
    const secondUrl =
      "https://s4.anilist.co/file/anilistcdn/staff/byte-budget-2.jpg";
    const thirdUrl =
      "https://s4.anilist.co/file/anilistcdn/staff/byte-budget-3.jpg";

    const largeDataUrl = createSizedDataUrl(largeEntryBytes);
    const smallDataUrl = createSizedDataUrl(256);

    imageDataUrlCache.set(firstUrl, {
      dataUrl: largeDataUrl,
      expiresAt,
      byteLength: Buffer.byteLength(largeDataUrl, "utf8"),
    });
    imageDataUrlCache.set(secondUrl, {
      dataUrl: largeDataUrl,
      expiresAt,
      byteLength: Buffer.byteLength(largeDataUrl, "utf8"),
    });
    imageDataUrlCache.set(thirdUrl, {
      dataUrl: smallDataUrl,
      expiresAt,
      byteLength: Buffer.byteLength(smallDataUrl, "utf8"),
    });

    const refreshedResult = await fetchImageAsDataUrl(firstUrl);

    expect(refreshedResult).toBe(largeDataUrl);
    expect(imageDataUrlCache.has(firstUrl)).toBe(true);
    expect(imageDataUrlCache.has(secondUrl)).toBe(false);
    expect(imageDataUrlCache.has(thirdUrl)).toBe(true);
    expect(getImageDataUrlMemoryCacheSizeBytes()).toBeLessThanOrEqual(
      IMAGE_DATA_URL_MEMORY_CACHE_MAX_BYTES,
    );
  });

  it("skips remote fetches when a hot render asks for cache-only image resolution", async () => {
    const imageUrl =
      "https://s4.anilist.co/file/anilistcdn/staff/cache-only.jpg";

    sharedRedisMockGet.mockResolvedValueOnce(null);

    const fetchMock = mock(async () => {
      throw new Error("remote fetch should not run in cache-only mode");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchImageAsDataUrl(imageUrl, { cacheOnly: true });

    expect(result).toBeNull();
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

    await flushMicrotasks();

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

  it("returns once the in-memory cache is primed instead of waiting on shared-cache persistence", async () => {
    const imageUrl =
      "https://s4.anilist.co/file/anilistcdn/staff/background-cache-write.jpg";

    sharedRedisMockGet.mockResolvedValueOnce(null);

    let rejectSharedCacheWrite: ((reason?: unknown) => void) | undefined;
    sharedRedisMockSet.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSharedCacheWrite = reject;
        }),
    );

    const fetchMock = mock().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resultPromise = fetchImageAsDataUrl(imageUrl);

    const settledResult = await Promise.race([
      resultPromise.then((value) => ({
        state: "resolved" as const,
        value,
      })),
      (async () => {
        await flushMicrotasks();
        return { state: "pending" as const };
      })(),
    ]);

    expect(settledResult.state).toBe("resolved");
    if (settledResult.state === "resolved") {
      expect(settledResult.value).toMatch(/^data:image\/png;base64,/);
    }

    expect(sharedRedisMockSet).toHaveBeenCalledTimes(1);

    rejectSharedCacheWrite?.(new Error("shared cache unavailable"));
    await flushMicrotasks();
  });

  it("skips shared-cache writes for oversized data URLs", async () => {
    const imageUrl =
      "https://s4.anilist.co/file/anilistcdn/staff/oversized-cache-entry.jpg";

    sharedRedisMockGet.mockResolvedValueOnce(null);

    const oversizedBufferBytes = Math.ceil(
      IMAGE_DATA_URL_SHARED_CACHE_MAX_BYTES * 0.8,
    );
    const fetchMock = mock().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () => new Uint8Array(oversizedBufferBytes).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchImageAsDataUrl(imageUrl);

    expect(result).toBeTruthy();
    expect(sharedRedisMockGet).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockSet).not.toHaveBeenCalled();
  });

  it("rejects redirects and keeps manual redirect handling enabled", async () => {
    const imageUrl = "https://s4.anilist.co/file/anilistcdn/staff/redirect.jpg";

    sharedRedisMockGet.mockResolvedValueOnce(null);

    const fetchMock = mock().mockResolvedValue({
      ok: false,
      status: 302,
      type: "basic",
      url: "https://example.com/redirected.png",
      headers: {
        get: () => null,
      },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchImageAsDataUrl(imageUrl);

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      imageUrl,
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(sharedRedisMockSet).not.toHaveBeenCalled();
  });

  it("only embeds the requested non-mixed favorites variant", async () => {
    const favourites = {
      anime: {
        nodes: [
          {
            id: 1,
            title: { romaji: "Anime" },
            coverImage: {
              large: "https://s4.anilist.co/file/anilistcdn/media/anime/1.jpg",
            },
          },
        ],
      },
      manga: {
        nodes: [
          {
            id: 2,
            title: { romaji: "Manga" },
            coverImage: {
              large: "https://s4.anilist.co/file/anilistcdn/media/manga/2.jpg",
            },
          },
        ],
      },
      characters: {
        nodes: [
          {
            id: 3,
            name: { full: "Character" },
            image: {
              large: "https://s4.anilist.co/file/anilistcdn/character/3.jpg",
            },
          },
        ],
      },
      staff: { nodes: [] },
      studios: { nodes: [] },
    };

    sharedRedisMockGet.mockResolvedValue(null);

    const fetchMock = mock().mockResolvedValue({
      ok: true,
      status: 200,
      type: "basic",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await embedFavoritesGridImages(favourites, "anime", 1, 1);

    expect(result.anime?.nodes?.[0]?.coverImage?.large).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(result.manga?.nodes?.[0]?.coverImage?.large).toBe(
      "https://s4.anilist.co/file/anilistcdn/media/manga/2.jpg",
    );
    expect(result.characters?.nodes?.[0]?.image?.large).toBe(
      "https://s4.anilist.co/file/anilistcdn/character/3.jpg",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://s4.anilist.co/file/anilistcdn/media/anime/1.jpg",
      expect.any(Object),
    );
  });

  it("only embeds mixed favorites entries that render in the template round-robin order", async () => {
    const animeOneUrl =
      "https://s4.anilist.co/file/anilistcdn/media/anime/101.jpg";
    const animeTwoUrl =
      "https://s4.anilist.co/file/anilistcdn/media/anime/102.jpg";
    const mangaOneUrl =
      "https://s4.anilist.co/file/anilistcdn/media/manga/201.jpg";
    const mangaTwoUrl =
      "https://s4.anilist.co/file/anilistcdn/media/manga/202.jpg";
    const characterOneUrl =
      "https://s4.anilist.co/file/anilistcdn/character/301.jpg";
    const characterTwoUrl =
      "https://s4.anilist.co/file/anilistcdn/character/302.jpg";
    const staffOneUrl = "https://s4.anilist.co/file/anilistcdn/staff/401.jpg";
    const staffTwoUrl = "https://s4.anilist.co/file/anilistcdn/staff/402.jpg";

    const favourites = {
      anime: {
        nodes: [
          {
            id: 101,
            title: { romaji: "Anime One" },
            coverImage: { large: animeOneUrl },
          },
          {
            id: 102,
            title: { romaji: "Anime Two" },
            coverImage: { large: animeTwoUrl },
          },
        ],
      },
      manga: {
        nodes: [
          {
            id: 201,
            title: { romaji: "Manga One" },
            coverImage: { large: mangaOneUrl },
          },
          {
            id: 202,
            title: { romaji: "Manga Two" },
            coverImage: { large: mangaTwoUrl },
          },
        ],
      },
      characters: {
        nodes: [
          {
            id: 301,
            name: { full: "Character One" },
            image: { large: characterOneUrl },
          },
          {
            id: 302,
            name: { full: "Character Two" },
            image: { large: characterTwoUrl },
          },
        ],
      },
      staff: {
        nodes: [
          {
            id: 401,
            name: { full: "Staff One" },
            image: { large: staffOneUrl },
          },
          {
            id: 402,
            name: { full: "Staff Two" },
            image: { large: staffTwoUrl },
          },
        ],
      },
      studios: {
        nodes: [
          { id: 501, name: "Studio One" },
          { id: 502, name: "Studio Two" },
        ],
      },
    };

    sharedRedisMockGet.mockResolvedValue(null);

    const fetchMock = mock().mockResolvedValue({
      ok: true,
      status: 200,
      type: "basic",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await embedFavoritesGridImages(favourites, "mixed", 2, 3);

    const fetchedUrls = fetchMock.mock.calls
      .map((call) => call[0] as string)
      .sort();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchedUrls).toEqual(
      [
        animeOneUrl,
        mangaOneUrl,
        mangaTwoUrl,
        characterOneUrl,
        staffOneUrl,
      ].sort(),
    );

    expect(result.anime?.nodes?.[0]?.coverImage?.large).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(result.anime?.nodes?.[1]?.coverImage?.large).toBe(animeTwoUrl);
    expect(result.manga?.nodes?.[0]?.coverImage?.large).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(result.manga?.nodes?.[1]?.coverImage?.large).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(result.characters?.nodes?.[0]?.image?.large).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(result.characters?.nodes?.[1]?.image?.large).toBe(characterTwoUrl);
    expect(result.staff?.nodes?.[0]?.image?.large).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(result.staff?.nodes?.[1]?.image?.large).toBe(staffTwoUrl);
  });

  it("bounds concurrent media cover embedding work on cold misses", async () => {
    const entries = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      progress: index + 1,
      media: {
        id: index + 100,
        title: { romaji: `Entry ${index + 1}` },
        coverImage: {
          large: `https://s4.anilist.co/file/anilistcdn/media/anime/${index + 100}.jpg`,
        },
      },
    }));

    sharedRedisMockGet.mockResolvedValue(null);

    let activeFetches = 0;
    let peakFetches = 0;
    const releaseFetches: Array<() => void> = [];
    const fetchMock = mock(
      () =>
        new Promise((resolve) => {
          activeFetches += 1;
          peakFetches = Math.max(peakFetches, activeFetches);
          releaseFetches.push(() => {
            activeFetches -= 1;
            resolve({
              ok: true,
              status: 200,
              type: "basic",
              headers: {
                get: (name: string) =>
                  name.toLowerCase() === "content-type" ? "image/png" : null,
              },
              arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
            });
          });
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const embedPromise = embedMediaListCoverImages(entries);

    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(peakFetches).toBe(4);

    while (releaseFetches.length > 0) {
      releaseFetches.shift()?.();
      await flushMicrotasks(4);
    }

    const result = await embedPromise;

    expect(result).toHaveLength(entries.length);
    expect(fetchMock).toHaveBeenCalledTimes(entries.length);
    expect(peakFetches).toBe(4);
    for (const entry of result) {
      expect(entry.media.coverImage?.large).toMatch(/^data:image\/png;base64,/);
    }
  });
});
