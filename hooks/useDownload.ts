"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAbsoluteUrl, svgToPng, type ConversionFormat } from "@/lib/utils";

export function useDownload(
  previewUrl: string | null,
  opts: { cardId: string; variant: string },
) {
  const { cardId, variant } = opts;
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isDownloadingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDownload = useCallback(
    async (format: ConversionFormat = "png") => {
      if (!previewUrl || isDownloadingRef.current) return;
      isDownloadingRef.current = true;
      if (isMountedRef.current) {
        setIsDownloading(true);
        setError(null);
      }
      let link: HTMLAnchorElement | null = null;
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        const dataUrl = await svgToPng(absoluteUrl, format);
        if (!dataUrl) throw new Error("Failed to convert SVG to image");
        link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${cardId}-${variant}.${format}`;
        document.body.appendChild(link);
        link.click();
      } catch (error) {
        console.error("Failed to download card:", error);
        if (isMountedRef.current) {
          setError(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        link?.remove();
        isDownloadingRef.current = false;
        if (isMountedRef.current) {
          setIsDownloading(false);
        }
      }
    },
    [previewUrl, cardId, variant],
  );

  return { isDownloading, error, handleDownload } as const;
}
