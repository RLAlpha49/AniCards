import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  clearSvgCache,
  getRemainingSvgCacheLifetimeMs,
  getSvgFromSharedCache,
  releaseSvgRevalidationLock,
  setSvgInSharedCache,
  tryAcquireSvgRevalidationLock,
} from "@/lib/stores/svg-cache";
import { sharedRedisMockGet, sharedRedisMockSet } from "@/tests/unit/__setup__";

describe("svg-cache shared Redis compression", () => {
  beforeEach(() => {
    clearSvgCache();
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
  });

  afterEach(() => {
    clearSvgCache();
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
  });

  it("stores compressed shared cache payloads and restores the original SVG on read", async () => {
    const cacheKey = "svg:542244:animeStats";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="800" height="400" fill="#0b1622"/><text x="20" y="40">${"AniCards shared cache compression ".repeat(320)}</text></svg>`;

    await setSvgInSharedCache(cacheKey, svg, 60_000, 542244, 8);

    const [storedKey, serializedEntry, setOptions] = sharedRedisMockSet.mock
      .calls[0] as [string, string, { ex?: number } | undefined];

    expect(storedKey).toBe(`svg-cache:${cacheKey}`);
    expect(setOptions).toEqual({ ex: 60 });

    const parsedEntry = JSON.parse(serializedEntry) as {
      compression?: string;
      svg?: string;
      svgCompressed?: string;
      ttl?: number;
      borderRadius?: number;
    };

    expect(parsedEntry.compression).toBe("gzip-base64-v1");
    expect(parsedEntry.svg).toBeUndefined();
    expect(parsedEntry.svgCompressed).toBeTruthy();
    expect(parsedEntry.svgCompressed).not.toContain("<svg");
    expect(parsedEntry.ttl).toBe(60_000);
    expect(parsedEntry.borderRadius).toBe(8);

    sharedRedisMockGet.mockResolvedValueOnce(serializedEntry);

    const restoredEntry = await getSvgFromSharedCache(cacheKey);

    expect(restoredEntry).toMatchObject({
      svg,
      ttl: 60_000,
      borderRadius: 8,
      isStale: false,
    });
  });

  it("stores smaller shared cache payloads uncompressed while preserving compatibility on read", async () => {
    const cacheKey = "svg:542244:animeStats:small";
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>small payload</text></svg>';

    await setSvgInSharedCache(cacheKey, svg, 45_000, 542244, 10);

    const [storedKey, serializedEntry, setOptions] = sharedRedisMockSet.mock
      .calls[0] as [string, string, { ex?: number } | undefined];

    expect(storedKey).toBe(`svg-cache:${cacheKey}`);
    expect(setOptions).toEqual({ ex: 45 });

    const parsedEntry = JSON.parse(serializedEntry) as {
      compression?: string;
      svg?: string;
      svgCompressed?: string;
      ttl?: number;
      borderRadius?: number;
    };

    expect(parsedEntry.compression).toBeUndefined();
    expect(parsedEntry.svg).toBe(svg);
    expect(parsedEntry.svgCompressed).toBeUndefined();
    expect(parsedEntry.ttl).toBe(45_000);
    expect(parsedEntry.borderRadius).toBe(10);

    sharedRedisMockGet.mockResolvedValueOnce(serializedEntry);

    const restoredEntry = await getSvgFromSharedCache(cacheKey);

    expect(restoredEntry).toMatchObject({
      svg,
      ttl: 45_000,
      borderRadius: 10,
      isStale: false,
    });
  });

  it("reads legacy uncompressed shared cache payloads safely", async () => {
    const cacheKey = "svg:542244:animeStats";
    const legacyEntry = JSON.stringify({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>legacy</text></svg>',
      cachedAt: Date.now(),
      ttl: 120_000,
      borderRadius: 6,
    });

    sharedRedisMockGet.mockResolvedValueOnce(legacyEntry);

    const restoredEntry = await getSvgFromSharedCache(cacheKey);

    expect(restoredEntry).toMatchObject({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>legacy</text></svg>',
      ttl: 120_000,
      borderRadius: 6,
      isStale: false,
    });
  });

  it("coalesces stale revalidation locks per cache key and resets them on release", () => {
    const cacheKey = "svg:542244:animeStats";

    expect(tryAcquireSvgRevalidationLock(cacheKey)).toBe(true);
    expect(tryAcquireSvgRevalidationLock(cacheKey)).toBe(false);

    releaseSvgRevalidationLock(cacheKey);

    expect(tryAcquireSvgRevalidationLock(cacheKey)).toBe(true);
  });

  it("clears any held revalidation locks when the cache is reset", () => {
    const cacheKey = "svg:542244:animeStats";

    expect(tryAcquireSvgRevalidationLock(cacheKey)).toBe(true);

    clearSvgCache();

    expect(tryAcquireSvgRevalidationLock(cacheKey)).toBe(true);
  });

  it("reports only the remaining shared-cache lifetime for L1 refreshes", () => {
    const now = Date.now();

    expect(
      getRemainingSvgCacheLifetimeMs(
        {
          cachedAt: now - 45_000,
          ttl: 60_000,
        },
        now,
      ),
    ).toBe(15_000);

    expect(
      getRemainingSvgCacheLifetimeMs(
        {
          cachedAt: now - 61_000,
          ttl: 60_000,
        },
        now,
      ),
    ).toBe(0);
  });
});
