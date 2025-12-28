"use client";

import { useCallback, useState } from "react";
import { getAbsoluteUrl, svgToPng, type ConversionFormat } from "@/lib/utils";

export function useDownload(
  previewUrl: string | null,
  opts: { cardId: string; variant: string },
) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(
    async (format: ConversionFormat = "png") => {
      if (!previewUrl || isDownloading) return;
      setIsDownloading(true);
      let link: HTMLAnchorElement | null = null;
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        const dataUrl = await svgToPng(absoluteUrl, format);
        link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${opts.cardId}-${opts.variant}.${format}`;
        document.body.appendChild(link);
        link.click();
      } catch (error) {
        console.error("Failed to download card:", error);
      } finally {
        link?.remove();
        setIsDownloading(false);
      }
    },
    [previewUrl, opts, isDownloading],
  );

  return { isDownloading, handleDownload } as const;
}
