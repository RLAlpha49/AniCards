"use client";

// Browser-only download hook for rendered card previews. Download state stays
// local to the caller because this is transient UI work: turn the current SVG
// preview into a file, trigger the browser download flow, and surface short-
// lived success or error feedback.

import { useCallback, useEffect, useRef, useState } from "react";

import { type ConversionFormat, getAbsoluteUrl, svgToPng } from "@/lib/utils";

export function useDownload(
  previewUrl: string | null,
  opts: { cardId: string; variant: string },
) {
  const { cardId, variant } = opts;
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<
    "idle" | "downloading" | "success" | "error"
  >("idle");
  // One ref blocks duplicate clicks inside the same download window; the other
  // avoids setting React state after the consuming component unmounts.
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
        setStatus("downloading");
      }
      let link: HTMLAnchorElement | null = null;
      let dataUrl: string | null = null;
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        dataUrl = await svgToPng(absoluteUrl, format);
        // Browsers still behave most consistently when downloads come from a
        // real anchor click instead of navigating directly to the data URL.
        link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${cardId}-${variant}.${format}`;
        document.body.appendChild(link);
        link.click();
        if (isMountedRef.current) {
          setStatus("success");
        }
      } catch (error) {
        console.error("Failed to download card:", error);
        if (isMountedRef.current) {
          setError(error instanceof Error ? error : new Error(String(error)));
          setStatus("error");
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

  return { isDownloading, error, handleDownload, status } as const;
}
