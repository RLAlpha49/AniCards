"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAndCachePreviewObjectUrl,
  getCachedPreviewObjectUrl,
  type PreviewFetchPriority,
} from "./preview-cache";

export type CachedCardPreviewState = {
  imageSrc: string | null;
  isLoading: boolean;
  error: string | null;
  /** Forces a new render with the latest underlying data. Returns the cache-bust token used. */
  refresh: () => Promise<string | null>;
};

type UseCachedCardPreviewOptions = {
  enabled?: boolean;
  priority?: PreviewFetchPriority;
};

export function useCachedCardPreview(
  apiHref: string | null,
  options: UseCachedCardPreviewOptions = {},
): CachedCardPreviewState {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = options.enabled ?? true;
  const priority = options.priority ?? "visible";

  const abortRef = useRef<AbortController | null>(null);
  const latestHrefRef = useRef<string | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    latestHrefRef.current = apiHref;
    setError(null);

    if (!apiHref) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    const cached = getCachedPreviewObjectUrl(apiHref);
    if (cached) {
      setImageSrc(cached);
      setIsLoading(false);
      return;
    }

    setImageSrc(null);

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;
    setIsLoading(true);

    void (async () => {
      try {
        const objectUrl = await fetchAndCachePreviewObjectUrl(apiHref, {
          priority,
          signal: ac.signal,
        });

        // Ignore if this request is stale.
        if (latestHrefRef.current !== apiHref) return;
        setImageSrc(objectUrl);
        setError(null);
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        if (latestHrefRef.current !== apiHref) return;
        setError(e instanceof Error ? e.message : "Failed to load preview");
        setImageSrc(null);
      } finally {
        if (latestHrefRef.current === apiHref) setIsLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [apiHref, enabled, priority]);

  const refresh = useCallback(async () => {
    if (!apiHref) return null;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const token = String(Date.now());
    setIsLoading(true);
    setError(null);

    try {
      const objectUrl = await fetchAndCachePreviewObjectUrl(apiHref, {
        cacheBust: token,
        force: true,
        priority: "active",
        signal: ac.signal,
      });
      if (latestHrefRef.current !== apiHref) return token;
      setImageSrc(objectUrl);
      return token;
    } catch (e: unknown) {
      if (!ac.signal.aborted && latestHrefRef.current === apiHref) {
        setError(e instanceof Error ? e.message : "Failed to refresh preview");
      }
      return null;
    } finally {
      if (latestHrefRef.current === apiHref) setIsLoading(false);
    }
  }, [apiHref]);

  return { imageSrc, isLoading, error, refresh };
}
