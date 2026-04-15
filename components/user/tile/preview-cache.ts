"use client";

// Shares rendered preview blobs across card tiles, expanded previews, and
// refresh actions. Cache-busting replaces the normalized entry instead of
// creating a second copy, which keeps memory bounded while still forcing a
// fresh server render when needed.

type PreviewCacheEntry = {
  objectUrl: string;
};

export type PreviewFetchPriority = "visible" | "active";

type PendingPreviewFetch = {
  key: string;
  order: number;
  priority: PreviewFetchPriority;
  signal?: AbortSignal;
  start: () => void;
};

const MAX_ENTRIES = 40;
const MAX_CONCURRENT_FETCHES = 4;

// LRU via insertion order: most recently used at the end.
const previewCache = new Map<string, PreviewCacheEntry>();

// Deduplicate concurrent fetches for the same normalized key.
const inFlight = new Map<string, Promise<PreviewCacheEntry>>();

const pendingFetches: PendingPreviewFetch[] = [];
let activeFetchCount = 0;
let nextPendingFetchOrder = 0;

// Used to prevent stale in-flight requests from overwriting newer refreshes.
const latestRequestIdByKey = new Map<string, number>();

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Preview request aborted.", "AbortError");
  }

  const error = new Error("Preview request aborted.");
  error.name = "AbortError";
  return error;
}

function getPriorityWeight(priority: PreviewFetchPriority): number {
  return priority === "active" ? 1 : 0;
}

function hasPendingFetchForKey(key: string): boolean {
  return pendingFetches.some((entry) => entry.key === key);
}

function pruneRequestBookkeeping(key: string) {
  if (previewCache.has(key)) return;
  if (inFlight.has(key)) return;
  if (hasPendingFetchForKey(key)) return;
  latestRequestIdByKey.delete(key);
}

function sortPendingFetches() {
  pendingFetches.sort((a, b) => {
    const priorityDelta =
      getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return a.order - b.order;
  });
}

function drainPendingFetchQueue() {
  while (activeFetchCount < MAX_CONCURRENT_FETCHES) {
    const next = pendingFetches.shift();
    if (!next) return;

    if (next.signal?.aborted) {
      pruneRequestBookkeeping(next.key);
      continue;
    }

    activeFetchCount += 1;
    next.start();
  }
}

function releasePendingFetchSlot() {
  activeFetchCount = Math.max(0, activeFetchCount - 1);
  queueMicrotask(drainPendingFetchQueue);
}

function removePendingFetch(entry: PendingPreviewFetch): boolean {
  const index = pendingFetches.indexOf(entry);
  if (index < 0) return false;

  pendingFetches.splice(index, 1);
  pruneRequestBookkeeping(entry.key);
  return true;
}

function queuePreviewFetch<T>(args: {
  key: string;
  priority: PreviewFetchPriority;
  signal?: AbortSignal;
  run: () => Promise<T>;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entry: PendingPreviewFetch = {
      key: args.key,
      order: nextPendingFetchOrder,
      priority: args.priority,
      signal: args.signal,
      start: () => {
        if (args.signal) {
          args.signal.removeEventListener("abort", handleAbort);
        }

        void args
          .run()
          .then(resolve, reject)
          .finally(() => {
            releasePendingFetchSlot();
            pruneRequestBookkeeping(args.key);
          });
      },
    };
    nextPendingFetchOrder += 1;

    const handleAbort = () => {
      if (!removePendingFetch(entry)) {
        return;
      }

      reject(createAbortError());
    };

    if (args.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    if (args.signal) {
      args.signal.addEventListener("abort", handleAbort, { once: true });
    }

    pendingFetches.push(entry);
    sortPendingFetches();
    drainPendingFetchQueue();
  });
}

function bumpRequestId(key: string): number {
  const next = (latestRequestIdByKey.get(key) ?? 0) + 1;
  latestRequestIdByKey.set(key, next);
  return next;
}

function safeRevokeObjectUrl(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore (some environments may not support revocation)
  }
}

function lruTouch(key: string, entry: PreviewCacheEntry) {
  previewCache.delete(key);
  previewCache.set(key, entry);
}

function lruEvictIfNeeded() {
  while (previewCache.size > MAX_ENTRIES) {
    const oldestIt = previewCache.keys().next();
    if (oldestIt.done) return;
    const oldestKey = oldestIt.value;
    const oldest = previewCache.get(oldestKey);
    previewCache.delete(oldestKey);
    if (oldest) safeRevokeObjectUrl(oldest.objectUrl);
    pruneRequestBookkeeping(oldestKey);
  }
}

function parseRelativeUrl(href: string): URL {
  return new URL(href, "https://example.invalid");
}

/**
 * Normalize the URL into a stable cache key.
 *
 * Notes:
 * - We strip `_t` so cache-busting refreshes replace the same entry.
 * - We intentionally do not sort params; upstream builders are stable.
 */
export function normalizePreviewCacheKey(apiHref: string): string {
  const url = parseRelativeUrl(apiHref);
  const params = new URLSearchParams(url.search);
  params.delete("_t");
  const search = params.toString();
  return search ? `${url.pathname}?${search}` : url.pathname;
}

function withCacheBust(apiHref: string, cacheBust: string | undefined): string {
  if (!cacheBust) return apiHref;
  const url = parseRelativeUrl(apiHref);
  url.searchParams.set("_t", cacheBust);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function getCachedPreviewObjectUrl(apiHref: string): string | null {
  const key = normalizePreviewCacheKey(apiHref);
  const entry = previewCache.get(key);
  if (!entry) return null;
  lruTouch(key, entry);
  return entry.objectUrl;
}

async function fetchPreviewBlob(
  apiHref: string,
  signal?: AbortSignal,
  forceRefresh?: boolean,
) {
  // If a cache-bust param `_t` is present or the caller requested a forced refresh,
  // prefer a no-store cache mode to ensure we get a fresh render from the server.
  const url = parseRelativeUrl(apiHref);
  const shouldBypassCache = forceRefresh || url.searchParams.has("_t");

  const res = await fetch(apiHref, {
    method: "GET",
    cache: shouldBypassCache ? "no-store" : "force-cache",
    headers: {
      Accept: "image/svg+xml,*/*",
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Preview fetch failed: ${res.status}`);
  }

  return await res.blob();
}

export async function fetchAndCachePreviewObjectUrl(
  apiHref: string,
  opts?: {
    /**
     * When set, a `_t` param is added to force the server to render fresh data.
     * The resulting image replaces the same normalized cache entry.
     */
    cacheBust?: string;
    signal?: AbortSignal;
    force?: boolean;
    priority?: PreviewFetchPriority;
  },
): Promise<string> {
  const key = normalizePreviewCacheKey(apiHref);

  if (!opts?.force) {
    const cached = previewCache.get(key);
    if (cached) {
      lruTouch(key, cached);
      return cached.objectUrl;
    }
  }

  // If a refresh is requested, we should not block on an older in-flight fetch.
  // We still dedupe refreshes themselves via the same key.
  const existingInFlight = inFlight.get(key);
  if (existingInFlight && !opts?.force) {
    const entry = await existingInFlight;
    lruTouch(key, entry);
    return entry.objectUrl;
  }

  const requestId = bumpRequestId(key);
  const priority = opts?.priority ?? (opts?.force ? "active" : "visible");

  const promise = queuePreviewFetch({
    key,
    priority,
    signal: opts?.signal,
    run: async () => {
      const fetchHref = withCacheBust(apiHref, opts?.cacheBust);
      const blob = await fetchPreviewBlob(fetchHref, opts?.signal, opts?.force);
      const objectUrl = URL.createObjectURL(blob);

      const nextEntry: PreviewCacheEntry = {
        objectUrl,
      };

      // If this request was superseded by a newer one (e.g. a forced refresh),
      // don't overwrite the newer cache entry.
      const superseded = latestRequestIdByKey.get(key) !== requestId;
      if (superseded) {
        const latestCached = previewCache.get(key);
        if (latestCached) {
          safeRevokeObjectUrl(objectUrl);
          lruTouch(key, latestCached);
          return latestCached;
        }

        const latestInFlight = inFlight.get(key);
        if (latestInFlight) {
          safeRevokeObjectUrl(objectUrl);
          return await latestInFlight;
        }
      }

      const previous = previewCache.get(key);
      previewCache.set(key, nextEntry);
      lruEvictIfNeeded();

      if (previous) {
        // Delay revocation very slightly to reduce the chance we revoke a URL
        // that is still painted on-screen.
        queueMicrotask(() => safeRevokeObjectUrl(previous.objectUrl));
      }

      return nextEntry;
    },
  });

  inFlight.set(key, promise);

  try {
    const entry = await promise;
    return entry.objectUrl;
  } finally {
    // Only clear if the stored promise is the same one (avoid races).
    if (inFlight.get(key) === promise) inFlight.delete(key);
    pruneRequestBookkeeping(key);
  }
}

export function __resetPreviewCacheForTests() {
  for (const entry of previewCache.values()) {
    safeRevokeObjectUrl(entry.objectUrl);
  }

  previewCache.clear();
  inFlight.clear();
  pendingFetches.splice(0, pendingFetches.length);
  latestRequestIdByKey.clear();
  activeFetchCount = 0;
  nextPendingFetchOrder = 0;
}

export function __getPreviewCacheDebugStateForTests() {
  return {
    activeFetchCount,
    cacheKeys: [...previewCache.keys()],
    cacheSize: previewCache.size,
    inFlightKeys: [...inFlight.keys()],
    inFlightSize: inFlight.size,
    latestRequestKeys: [...latestRequestIdByKey.keys()],
    latestRequestSize: latestRequestIdByKey.size,
    pendingKeys: pendingFetches.map((entry) => entry.key),
    pendingSize: pendingFetches.length,
  };
}
