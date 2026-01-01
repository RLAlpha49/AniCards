"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import { Eye, ExternalLink, MoreHorizontal } from "lucide-react";
import { CopyPopover } from "@/components/user/tile/CopyPopover";
import { DownloadPopover } from "@/components/user/tile/DownloadPopover";
import { cn, type ConversionFormat } from "@/lib/utils";

/**
 * Maps a preview URL to the internal /api/card endpoint.
 * Extracts only the query parameters from the preview URL,
 * allowing the local API to handle card rendering regardless
 * of the original URL's hostname or path.
 */
function toCardApiHref(previewUrl: string): string | null {
  try {
    const url = new URL(previewUrl, "https://example.invalid");

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return `/api/card${url.search}`;
  } catch {
    return null;
  }
}

interface CardPreviewProps {
  previewUrl: string | null;
  label: string;
  previewUnavailableId: string;
  convertingId: string;
  isDownloading: boolean;
  copiedFormat: "url" | "anilist" | "failed-list" | null;
  copyPopoverOpen: boolean;
  setCopyPopoverOpen: (open: boolean) => void;
  downloadPopoverOpen: boolean;
  setDownloadPopoverOpen: (open: boolean) => void;
  onCopyUrl: () => Promise<void> | void;
  onCopyAniList: () => Promise<void> | void;
  onDownload: (format: ConversionFormat) => Promise<void> | void;
  isAnyPopoverOpen: boolean;
  borderRadiusValue?: string | number;
}

export const CardPreview = memo(function CardPreview({
  previewUrl,
  label,
  previewUnavailableId,
  convertingId,
  isDownloading,
  copiedFormat,
  copyPopoverOpen,
  setCopyPopoverOpen,
  downloadPopoverOpen,
  setDownloadPopoverOpen,
  onCopyUrl,
  onCopyAniList,
  onDownload,
  isAnyPopoverOpen,
  borderRadiusValue,
}: Readonly<CardPreviewProps>) {
  let downloadTitle: string | undefined;
  let downloadDescrId: string | undefined;
  if (!previewUrl) {
    downloadTitle = "Preview not available";
    downloadDescrId = previewUnavailableId;
  } else if (isDownloading) {
    downloadTitle = "Converting...";
    downloadDescrId = convertingId;
  } else {
    downloadTitle = undefined;
    downloadDescrId = undefined;
  }

  const openHref = previewUrl ? toCardApiHref(previewUrl) : null;

  // Local state to support tapping/focus to reveal quick actions on touch / keyboard
  const [showActions, setShowActions] = useState(false);

  // Close the actions overlay on Escape when opened via the toggle
  useEffect(() => {
    if (!showActions) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowActions(false);
    }
    globalThis.addEventListener("keydown", handleKey);
    return () => globalThis.removeEventListener("keydown", handleKey);
  }, [showActions]);

  return (
    <div className="group relative aspect-[2/1] overflow-hidden bg-slate-100 dark:bg-slate-950">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={`${label} preview`}
          fill
          sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className={cn(
            "object-contain p-2",
            "transition-transform duration-300 ease-out will-change-transform",
            "group-focus-within:scale-[1.04] group-hover:scale-[1.04]",
          )}
          style={{ borderRadius: borderRadiusValue }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <Eye className="h-8 w-8" />
        </div>
      )}

      {/* Subtle scrim for better hierarchy when actions appear */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-black/0 to-black/0",
          "transition-opacity duration-200",
          isAnyPopoverOpen || showActions
            ? "opacity-100"
            : "opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0",
        )}
      />

      {/* Touch-friendly toggle for small screens (tap to reveal actions) */}
      <button
        type="button"
        aria-label="Toggle card actions"
        aria-pressed={showActions}
        onClick={() => setShowActions((v) => !v)}
        className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:hidden"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Keyboard-only toggle for desktop — hidden visually but becomes visible when focused */}
      <button
        type="button"
        aria-label="Toggle card actions"
        aria-pressed={showActions}
        onClick={() => setShowActions((v) => !v)}
        className="absolute right-2 top-2 z-20 hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white opacity-0 hover:bg-white/20 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:inline-flex"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Quick Actions Overlay */}
      {!previewUrl && (
        <span id={previewUnavailableId} className="sr-only">
          Preview not available
        </span>
      )}
      {isDownloading && (
        <span id={convertingId} className="sr-only">
          Converting...
        </span>
      )}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-2 transition-opacity",
          isAnyPopoverOpen || showActions
            ? "visible opacity-100"
            : "visible opacity-100 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 sm:invisible sm:opacity-0",
        )}
      >
        {openHref ? (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-white shadow-lg transition-all",
              "border-2 border-white/80 bg-white/20 backdrop-blur-sm",
              "hover:border-white hover:bg-white/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30",
            )}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>Open</span>
            <span className="sr-only"> {label}</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-describedby={previewUnavailableId}
            title="Preview not available"
            className={cn(
              "inline-flex h-8 cursor-not-allowed items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-white shadow-lg transition-all",
              "border-2 border-white/80 bg-white/20 opacity-70 backdrop-blur-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30",
            )}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>Open</span>
            <span className="sr-only"> {label}</span>
          </button>
        )}
        <CopyPopover
          open={copyPopoverOpen}
          onOpenChange={setCopyPopoverOpen}
          previewUrl={previewUrl}
          copiedFormat={copiedFormat}
          onCopyUrl={onCopyUrl}
          onCopyAniList={onCopyAniList}
          previewUnavailableId={previewUnavailableId}
        />
        <DownloadPopover
          open={downloadPopoverOpen}
          onOpenChange={setDownloadPopoverOpen}
          previewUrl={previewUrl}
          isDownloading={isDownloading}
          onDownload={onDownload}
          downloadDescrId={downloadDescrId}
          downloadTitle={downloadTitle}
        />
      </div>
    </div>
  );
});

CardPreview.displayName = "CardPreview";
