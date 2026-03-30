"use client";

// Browser-only download hook for rendered card previews. Download state stays
// local to the caller because this is transient UI work: turn the current SVG
// preview into a file, trigger the browser download flow, and surface short-
// lived success or error feedback.

import { useCallback, useEffect, useRef, useState } from "react";

import { getCachedPreviewObjectUrl } from "@/components/user/tile/preview-cache";
import {
  type CardDownloadFormat,
  convertSvgToBlob,
  getAbsoluteUrl,
  readSvgMarkupFromObjectUrl,
  readSvgMarkupFromUrl,
  toCardApiHref,
} from "@/lib/utils";

async function resolveDownloadSvgMarkup(
  previewUrl: string,
  cachedSvgObjectUrl: string | null,
): Promise<string> {
  if (cachedSvgObjectUrl) {
    try {
      return await readSvgMarkupFromObjectUrl(cachedSvgObjectUrl);
    } catch (error) {
      console.warn(
        "Failed to reuse cached preview SVG for download; falling back to a live SVG fetch.",
        error,
      );
    }
  }

  return await readSvgMarkupFromUrl(previewUrl);
}

async function createRasterDownloadUrl(
  previewUrl: string,
  cachedSvgObjectUrl: string | null,
  format: Exclude<CardDownloadFormat, "svg">,
): Promise<string> {
  let conversionSource:
    | string
    | {
        svgContent: string;
      } = previewUrl;

  if (cachedSvgObjectUrl) {
    try {
      conversionSource = {
        svgContent: await readSvgMarkupFromObjectUrl(cachedSvgObjectUrl),
      };
    } catch (error) {
      console.warn(
        "Failed to reuse cached preview SVG for download; falling back to URL conversion.",
        error,
      );
    }
  }

  const rasterBlob = await convertSvgToBlob(conversionSource, format);
  return URL.createObjectURL(rasterBlob);
}

async function createDownloadObjectUrl(
  previewUrl: string,
  cachedSvgObjectUrl: string | null,
  format: CardDownloadFormat,
): Promise<string> {
  if (format === "svg") {
    const svgMarkup = await resolveDownloadSvgMarkup(
      previewUrl,
      cachedSvgObjectUrl,
    );

    return URL.createObjectURL(
      new Blob([svgMarkup], { type: "image/svg+xml" }),
    );
  }

  return await createRasterDownloadUrl(previewUrl, cachedSvgObjectUrl, format);
}

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
    async (format: CardDownloadFormat = "png") => {
      if (!previewUrl || isDownloadingRef.current) return;
      isDownloadingRef.current = true;
      if (isMountedRef.current) {
        setIsDownloading(true);
        setError(null);
        setStatus("downloading");
      }
      let link: HTMLAnchorElement | null = null;
      let downloadUrl: string | null = null;
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        const previewApiHref = toCardApiHref(previewUrl);
        const cachedSvgObjectUrl = previewApiHref
          ? getCachedPreviewObjectUrl(previewApiHref)
          : null;

        downloadUrl = await createDownloadObjectUrl(
          absoluteUrl,
          cachedSvgObjectUrl,
          format,
        );

        // Browsers still behave most consistently when downloads come from a
        // real anchor click instead of navigating directly to the response.
        link = document.createElement("a");
        link.href = downloadUrl;
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
        if (downloadUrl) {
          URL.revokeObjectURL(downloadUrl);
        }
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
