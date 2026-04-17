import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import {
  createDeferred,
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom();

const {
  __getPreviewCacheDebugStateForTests,
  __resetPreviewCacheForTests,
  fetchAndCachePreviewObjectUrl,
  normalizePreviewCacheKey,
} = await import("@/components/user/tile/preview-cache");

type MockPreviewResponse = Pick<Response, "ok" | "blob">;

function getPreviewRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function createPreviewResponse(seed: string): MockPreviewResponse {
  return {
    ok: true,
    blob: async () =>
      new Blob([`<svg data-seed="${seed}" />`], {
        type: "image/svg+xml",
      }),
  };
}

const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const fetchMock = mock<(input: string | URL | Request) => Promise<Response>>();
const createObjectURL = mock((blob: Blob | MediaSource) => {
  if (!blob) {
    throw new Error("Expected a preview blob");
  }

  return `blob:preview-${createObjectURL.mock.calls.length}`;
});
const revokeObjectURL = mock(() => {});

beforeEach(() => {
  resetHappyDom();
  __resetPreviewCacheForTests();
  fetchMock.mockReset();
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();

  fetchMock.mockImplementation(async (input) => {
    const url = getPreviewRequestUrl(input);
    return createPreviewResponse(url) as Response;
  });
  createObjectURL.mockImplementation(
    () => `blob:preview-${createObjectURL.mock.calls.length}`,
  );

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  __resetPreviewCacheForTests();
  globalThis.fetch = originalFetch;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
});

afterAll(() => {
  restoreHappyDom();
});

describe("preview-cache", () => {
  it("prunes latest-request bookkeeping when LRU entries are evicted", async () => {
    for (let index = 0; index <= 40; index += 1) {
      await fetchAndCachePreviewObjectUrl(`/api/card?card=card-${index}`);
    }

    const evictedKey = normalizePreviewCacheKey("/api/card?card=card-0");
    const latestKey = normalizePreviewCacheKey("/api/card?card=card-40");
    const debugState = __getPreviewCacheDebugStateForTests();

    expect(fetchMock).toHaveBeenCalledTimes(41);
    expect(createObjectURL).toHaveBeenCalledTimes(41);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(debugState.cacheSize).toBe(40);
    expect(debugState.latestRequestKeys).toHaveLength(40);
    expect(debugState.cacheKeys).not.toContain(evictedKey);
    expect(debugState.latestRequestKeys).not.toContain(evictedKey);
    expect(debugState.cacheKeys).toContain(latestKey);
    expect(debugState.latestRequestKeys).toContain(latestKey);
  });

  it("limits concurrent fetches and prioritizes active previews ahead of queued visible ones", async () => {
    const startedUrls: string[] = [];
    const deferredByUrl = new Map<
      string,
      ReturnType<typeof createDeferred<MockPreviewResponse>>
    >();

    fetchMock.mockImplementation((input) => {
      const url = getPreviewRequestUrl(input);
      startedUrls.push(url);

      let deferred = deferredByUrl.get(url);
      if (!deferred) {
        deferred = createDeferred<MockPreviewResponse>();
        deferredByUrl.set(url, deferred);
      }

      return deferred.promise as Promise<Response>;
    });

    const firstWaveUrls = [1, 2, 3, 4].map(
      (index) => `/api/card?card=seed-${index}`,
    );
    const queuedVisibleUrl = "/api/card?card=seed-5";
    const queuedActiveUrl = "/api/card?card=seed-6";

    const firstWavePromises = firstWaveUrls.map((url) =>
      fetchAndCachePreviewObjectUrl(url),
    );
    const queuedVisiblePromise =
      fetchAndCachePreviewObjectUrl(queuedVisibleUrl);
    const queuedActivePromise = fetchAndCachePreviewObjectUrl(queuedActiveUrl, {
      priority: "active",
    });

    await flushMicrotasks(10);

    expect(startedUrls).toEqual(firstWaveUrls);
    expect(__getPreviewCacheDebugStateForTests()).toMatchObject({
      activeFetchCount: 4,
      pendingKeys: [
        normalizePreviewCacheKey(queuedActiveUrl),
        normalizePreviewCacheKey(queuedVisibleUrl),
      ],
    });

    const firstDeferred = deferredByUrl.get(firstWaveUrls[0]);
    if (!firstDeferred) {
      throw new Error("Expected the first wave fetch to be deferred.");
    }
    firstDeferred.resolve(createPreviewResponse(firstWaveUrls[0]));

    await flushMicrotasks(10);

    expect(startedUrls).toEqual([...firstWaveUrls, queuedActiveUrl]);
    expect(__getPreviewCacheDebugStateForTests()).toMatchObject({
      activeFetchCount: 4,
      pendingKeys: [normalizePreviewCacheKey(queuedVisibleUrl)],
    });

    const secondDeferred = deferredByUrl.get(firstWaveUrls[1]);
    if (!secondDeferred) {
      throw new Error("Expected the second wave fetch to be deferred.");
    }
    secondDeferred.resolve(createPreviewResponse(firstWaveUrls[1]));

    await flushMicrotasks(10);

    expect(startedUrls).toEqual([
      ...firstWaveUrls,
      queuedActiveUrl,
      queuedVisibleUrl,
    ]);

    for (const url of [
      firstWaveUrls[2],
      firstWaveUrls[3],
      queuedActiveUrl,
      queuedVisibleUrl,
    ]) {
      const deferred = deferredByUrl.get(url);
      if (!deferred) {
        throw new Error(`Expected a deferred fetch for ${url}.`);
      }
      deferred.resolve(createPreviewResponse(url));
    }

    await Promise.all([
      ...firstWavePromises,
      queuedVisiblePromise,
      queuedActivePromise,
    ]);

    expect(__getPreviewCacheDebugStateForTests()).toMatchObject({
      activeFetchCount: 0,
      pendingKeys: [],
      inFlightKeys: [],
    });
  });
});
