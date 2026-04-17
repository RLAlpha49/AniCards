// useDownload.ts
//
// Browser-only download hook for rendered card previews.
// It turns the current preview into a file, reuses the cached SVG when possible,
// and keeps the download status local because this is short-lived UI feedback.
//
// Object URLs are revoked after each download so repeated exports do not leak memory
// during long editing sessions.

"use client";

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

interface DownloadTarget {
  href: string;
  revokeObjectUrl: boolean;
}

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
  previewApiHref: string | null,
  format: Exclude<CardDownloadFormat, "svg">,
): Promise<DownloadTarget> {
  if (format === "png" && previewApiHref) {
    try {
      const cardUrl = new URL(previewApiHref, "https://example.invalid");
      return {
        href: `/card.png${cardUrl.search}`,
        revokeObjectUrl: false,
      };
    } catch {
      // Fall through to the conversion API when the normalized card route cannot be parsed.
    }
  }

  const rasterBlob = await convertSvgToBlob(previewUrl, format);
  return {
    href: URL.createObjectURL(rasterBlob),
    revokeObjectUrl: true,
  };
}

async function createDownloadTarget(
  previewUrl: string,
  previewApiHref: string | null,
  cachedSvgObjectUrl: string | null,
  format: CardDownloadFormat,
): Promise<DownloadTarget> {
  if (format === "svg") {
    const svgMarkup = await resolveDownloadSvgMarkup(
      previewUrl,
      cachedSvgObjectUrl,
    );

    return {
      href: URL.createObjectURL(
        new Blob([svgMarkup], { type: "image/svg+xml" }),
      ),
      revokeObjectUrl: true,
    };
  }

  return await createRasterDownloadUrl(previewUrl, previewApiHref, format);
}

/**
 * Creates a download action for the current preview.
 *
 * SVG downloads reuse the live preview markup, while raster formats convert that SVG
 * through the shared API utilities so the downloaded file matches the on-screen card.
 */
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
      let revokeObjectUrl = false;
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        const previewApiHref = toCardApiHref(previewUrl);
        const cachedSvgObjectUrl =
          format === "svg" && previewApiHref
            ? getCachedPreviewObjectUrl(previewApiHref)
            : null;

        const downloadTarget = await createDownloadTarget(
          absoluteUrl,
          previewApiHref,
          cachedSvgObjectUrl,
          format,
        );
        downloadUrl = downloadTarget.href;
        revokeObjectUrl = downloadTarget.revokeObjectUrl;

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
        if (downloadUrl && revokeObjectUrl) {
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
