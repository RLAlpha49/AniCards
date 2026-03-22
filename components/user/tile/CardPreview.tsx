"use client";

// Renders the preview surface and its action overlay. All open/refresh/copy/
// download flows share the same normalized `/api/card` source so the cached
// preview, expanded view, and new-tab view stay in sync.

import { ExternalLink, Eye, MoreHorizontal, RotateCw } from "lucide-react";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { CopyPopover } from "@/components/user/tile/CopyPopover";
import { DownloadPopover } from "@/components/user/tile/DownloadPopover";
import { useCachedCardPreview } from "@/components/user/tile/useCachedCardPreview";
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

function withCacheBust(apiHref: string, cacheBust: string | null): string {
  if (!cacheBust) return apiHref;
  try {
    const url = new URL(apiHref, "https://example.invalid");
    url.searchParams.set("_t", cacheBust);
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return apiHref;
  }
}

/**
 * Returns padding class for preview size.
 * Smaller previews get more padding to avoid a cramped appearance;
 * larger previews get less padding to maximize image display area.
 */
function getPaddingClass(size: "sm" | "md" | "lg"): string {
  switch (size) {
    case "sm":
      return "p-4";
    case "lg":
      return "p-1";
    case "md":
    default:
      return "p-2";
  }
}

function getDownloadA11yState(args: {
  previewUrl: string | null;
  isDownloading: boolean;
  previewUnavailableId: string;
  convertingId: string;
}): { downloadTitle: string | undefined; downloadDescrId: string | undefined } {
  if (!args.previewUrl) {
    return {
      downloadTitle: "Preview not available",
      downloadDescrId: args.previewUnavailableId,
    };
  }
  if (args.isDownloading) {
    return {
      downloadTitle: "Converting...",
      downloadDescrId: args.convertingId,
    };
  }
  return { downloadTitle: undefined, downloadDescrId: undefined };
}

function OpenInNewTabButton(
  args: Readonly<{
    openHref: string | null;
    label: string;
    isPreviewAvailable: boolean;
    previewUnavailableId: string;
  }>,
) {
  if (args.openHref) {
    return (
      <a
        href={args.openHref}
        target="_blank"
        rel="noopener noreferrer"
        title="Preview in new tab"
        className={cn(
          "pointer-events-auto",
          "inline-flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all",
          "border-gold/20 bg-background/80 text-foreground border backdrop-blur-sm",
          "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
          "focus-visible:ring-gold/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        <ExternalLink className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Open preview in new tab {args.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-describedby={
        args.isPreviewAvailable ? undefined : args.previewUnavailableId
      }
      title="Preview not available"
      className={cn(
        "pointer-events-auto",
        "inline-flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full shadow-lg transition-all",
        "border-gold/20 bg-background/80 text-foreground border opacity-70 backdrop-blur-sm",
        "focus-visible:ring-gold/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      <ExternalLink className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">Open preview in new tab {args.label}</span>
    </button>
  );
}

function RefreshPreviewButton(
  args: Readonly<{
    disabled: boolean;
    onRefresh: () => void;
    title: string;
    ariaLabel: string;
  }>,
) {
  return (
    <button
      type="button"
      onClick={args.onRefresh}
      disabled={args.disabled}
      aria-disabled={args.disabled}
      aria-label={args.ariaLabel}
      title={args.title}
      className={cn(
        "pointer-events-auto",
        "inline-flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all",
        "border-gold/20 bg-background/80 text-foreground border backdrop-blur-sm",
        "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
        "focus-visible:ring-gold/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        args.disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <RotateCw className="h-5 w-5" aria-hidden="true" />
    </button>
  );
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
  forceActionsVisible?: boolean;
  /** Notifies the parent when the pointer is over the preview area. */
  onHoverChange?: (hovered: boolean) => void;
  borderRadiusValue?: string | number;
  previewSize?: "sm" | "md" | "lg";
  hideCopyDownload?: boolean;
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
  forceActionsVisible = false,
  onHoverChange,
  borderRadiusValue,
  previewSize = "md",
  hideCopyDownload = false,
}: Readonly<CardPreviewProps>) {
  const { downloadTitle, downloadDescrId } = getDownloadA11yState({
    previewUrl,
    isDownloading,
    previewUnavailableId,
    convertingId,
  });

  const openHrefBase = useMemo(
    () => (previewUrl ? toCardApiHref(previewUrl) : null),
    [previewUrl],
  );

  const { imageSrc, isLoading, error, refresh } =
    useCachedCardPreview(openHrefBase);

  const [lastRefreshToken, setLastRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    setLastRefreshToken(null);
  }, [openHrefBase]);

  const openHref = useMemo(
    () => (openHrefBase ? withCacheBust(openHrefBase, lastRefreshToken) : null),
    [openHrefBase, lastRefreshToken],
  );

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

  const paddingClass = getPaddingClass(previewSize);

  const shouldRenderFallbackSrc = Boolean(previewUrl && error);
  const resolvedSrc = imageSrc ?? (shouldRenderFallbackSrc ? previewUrl : null);

  let previewNode: ReactNode;
  if (!previewUrl) {
    previewNode = (
      <div className="text-muted-foreground flex h-full w-full items-center justify-center">
        <Eye className="h-8 w-8" />
      </div>
    );
  } else if (!resolvedSrc && isLoading) {
    previewNode = (
      <div className={cn("h-full w-full", paddingClass)}>
        <Skeleton className="h-full w-full" />
        <span className="sr-only">Loading preview...</span>
      </div>
    );
  } else if (resolvedSrc) {
    previewNode = (
      <img
        src={resolvedSrc}
        alt={`${label} preview`}
        loading="lazy"
        decoding="async"
        className={cn(
          "blur-0 absolute inset-0 h-full w-full object-contain brightness-100",
          paddingClass,
          "transition-all duration-300 ease-out will-change-[transform,filter]",
          "group-focus-within/card-preview:scale-[1.02] group-hover/card-preview:scale-[1.02]",
          "group-focus-within/card-preview:blur-[2px] group-hover/card-preview:blur-[2px]",
          "group-focus-within/card-preview:brightness-[0.7] group-hover/card-preview:brightness-[0.7]",
        )}
        style={{ borderRadius: borderRadiusValue }}
      />
    );
  } else {
    previewNode = (
      <div className="text-muted-foreground flex h-full w-full items-center justify-center">
        <LoadingSpinner
          size="md"
          className="text-muted-foreground"
          text={isLoading ? "Loading preview..." : "Preview unavailable"}
        />
      </div>
    );
  }

  const overlayPinned = isAnyPopoverOpen || showActions || forceActionsVisible;

  return (
    <div
      data-tour="card-preview"
      className="group/card-preview bg-gold/3 dark:bg-gold/2 relative aspect-2/1 overflow-hidden"
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
    >
      {previewNode}

      {/* Subtle scrim for better hierarchy when actions appear */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-t from-black/15 via-black/0 to-black/0",
          "transition-opacity duration-200",
          overlayPinned
            ? "opacity-100"
            : "opacity-0 group-focus-within/card-preview:opacity-100 group-hover/card-preview:opacity-100",
        )}
      />

      {/* Touch-friendly toggle for small screens (tap to reveal actions) */}
      <button
        type="button"
        aria-label={`Toggle actions for ${label}`}
        aria-pressed={showActions}
        onClick={() => setShowActions((v) => !v)}
        className="absolute top-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:hidden"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Keyboard-only toggle for desktop — hidden visually but becomes visible when focused */}
      <button
        type="button"
        aria-label={`Toggle actions for ${label}`}
        aria-pressed={showActions}
        onClick={() => setShowActions((v) => !v)}
        className="pointer-events-none absolute top-2 right-2 z-20 hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:inline-flex"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

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
          "pointer-events-none absolute inset-0 flex items-center justify-center gap-3 transition-opacity duration-300",
          overlayPinned
            ? "opacity-100"
            : "opacity-0 group-focus-within/card-preview:opacity-100 group-hover/card-preview:opacity-100",
        )}
      >
        <OpenInNewTabButton
          openHref={openHref}
          label={label}
          isPreviewAvailable={Boolean(previewUrl)}
          previewUnavailableId={previewUnavailableId}
        />

        <RefreshPreviewButton
          disabled={!previewUrl || isLoading}
          title={previewUrl ? "Refresh preview" : "Preview not available"}
          ariaLabel={`Refresh preview for ${label}`}
          onRefresh={() => {
            void (async () => {
              try {
                const token = await refresh();
                if (token) setLastRefreshToken(token);
              } catch (err) {
                const error =
                  err instanceof Error ? err : new Error(String(err));
                console.error("Failed to refresh preview:", error);
              }
            })();
          }}
        />

        {hideCopyDownload ? null : (
          <>
            <div className="pointer-events-auto">
              <CopyPopover
                open={copyPopoverOpen}
                onOpenChange={setCopyPopoverOpen}
                previewUrl={previewUrl}
                copiedFormat={copiedFormat}
                onCopyUrl={onCopyUrl}
                onCopyAniList={onCopyAniList}
                previewUnavailableId={previewUnavailableId}
              />
            </div>
            <div className="pointer-events-auto">
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
          </>
        )}
      </div>
    </div>
  );
});

CardPreview.displayName = "CardPreview";
