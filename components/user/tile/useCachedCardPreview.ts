"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAndCachePreviewObjectUrl,
  getCachedPreviewObjectUrl,
} from "./preview-cache";

export type CachedCardPreviewState = {
  imageSrc: string | null;
  isLoading: boolean;
  error: string | null;
  /** Forces a new render with the latest underlying data. Returns the cache-bust token used. */
  refresh: () => Promise<string | null>;
};

export function useCachedCardPreview(
  apiHref: string | null,
): CachedCardPreviewState {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const ac = new AbortController();
    abortRef.current = ac;
    setIsLoading(true);

    void (async () => {
      try {
        const objectUrl = await fetchAndCachePreviewObjectUrl(apiHref, {
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
  }, [apiHref]);

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
