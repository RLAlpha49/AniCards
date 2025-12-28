"use client";

import { useCallback, useRef, useState } from "react";
import { getAbsoluteUrl, svgToPng, type ConversionFormat } from "@/lib/utils";

export function useDownload(
  previewUrl: string | null,
  opts: { cardId: string; variant: string },
) {
  const { cardId, variant } = opts;
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadingRef = useRef(false);

  const handleDownload = useCallback(
    async (format: ConversionFormat = "png") => {
      if (!previewUrl || isDownloadingRef.current) return;
      isDownloadingRef.current = true;
      setIsDownloading(true);
      let link: HTMLAnchorElement | null = null;
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        const dataUrl = await svgToPng(absoluteUrl, format);
        link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${cardId}-${variant}.${format}`;
        document.body.appendChild(link);
        link.click();
      } catch (error) {
        console.error("Failed to download card:", error);
      } finally {
        link?.remove();
        isDownloadingRef.current = false;
        setIsDownloading(false);
      }
    },
    [previewUrl, cardId, variant],
  );

  return { isDownloading, handleDownload } as const;
}
