"use client";

// Renders the preview surface and its action overlay. All open/refresh/copy/
// download flows share the same normalized `/api/card` source so the cached
// preview, expanded view, and new-tab view stay in sync.

import { ExternalLink, Eye, MoreHorizontal, RotateCw } from "lucide-react";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { CopyPopover } from "@/components/user/tile/CopyPopover";
import { DownloadPopover } from "@/components/user/tile/DownloadPopover";
import { type PreviewFetchPriority } from "@/components/user/tile/preview-cache";
import { useCachedCardPreview } from "@/components/user/tile/useCachedCardPreview";
import { type CardDownloadFormat, cn, toCardApiHref } from "@/lib/utils";

const PREVIEW_VIEWPORT_ROOT_MARGIN = "240px 0px";

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
      downloadTitle: "Preparing download...",
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
    className?: string;
    iconClassName?: string;
    visibleLabel?: string;
  }>,
) {
  if (args.openHref) {
    return (
      <a
        href={args.openHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open preview in new tab ${args.label}`}
        title="Preview in new tab"
        className={cn(
          "pointer-events-auto",
          "inline-flex size-10 items-center justify-center rounded-full shadow-lg transition-all",
          "border border-gold/20 bg-background/80 text-foreground backdrop-blur-sm",
          "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
          `
            focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
            focus-visible:outline-none
          `,
          args.className,
        )}
      >
        <ExternalLink
          className={cn("size-5", args.iconClassName)}
          aria-hidden="true"
        />
        {args.visibleLabel ? <span>{args.visibleLabel}</span> : null}
        <span className="sr-only">Open preview in new tab {args.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label={`Open preview in new tab ${args.label}`}
      aria-describedby={
        args.isPreviewAvailable ? undefined : args.previewUnavailableId
      }
      title="Preview not available"
      className={cn(
        "pointer-events-auto",
        `
          inline-flex size-10 cursor-not-allowed items-center justify-center rounded-full shadow-lg
          transition-all
        `,
        "border border-gold/20 bg-background/80 text-foreground opacity-70 backdrop-blur-sm",
        `
          focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
          focus-visible:outline-none
        `,
        args.className,
      )}
    >
      <ExternalLink
        className={cn("size-5", args.iconClassName)}
        aria-hidden="true"
      />
      {args.visibleLabel ? <span>{args.visibleLabel}</span> : null}
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
    className?: string;
    iconClassName?: string;
    visibleLabel?: string;
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
        "inline-flex size-10 items-center justify-center rounded-full shadow-lg transition-all",
        "border border-gold/20 bg-background/80 text-foreground backdrop-blur-sm",
        "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
        `
          focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
          focus-visible:outline-none
        `,
        args.disabled && "cursor-not-allowed opacity-70",
        args.className,
      )}
    >
      <RotateCw
        className={cn("size-5", args.iconClassName)}
        aria-hidden="true"
      />
      {args.visibleLabel ? <span>{args.visibleLabel}</span> : null}
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
  copyError?: string | null;
  downloadError?: string | null;
  copyPopoverOpen: boolean;
  setCopyPopoverOpen: (open: boolean) => void;
  downloadPopoverOpen: boolean;
  setDownloadPopoverOpen: (open: boolean) => void;
  onCopyUrl: () => Promise<void> | void;
  onCopyAniList: () => Promise<void> | void;
  onDownload: (format: CardDownloadFormat) => Promise<void> | void;
  isAnyPopoverOpen: boolean;
  forceActionsVisible?: boolean;
  /** Notifies the parent when the pointer is over the preview area. */
  onHoverChange?: (hovered: boolean) => void;
  borderRadiusValue?: string | number;
  previewSize?: "sm" | "md" | "lg";
  hideCopyDownload?: boolean;
  prefersCoarsePointer?: boolean;
  fetchPriority?: PreviewFetchPriority;
}

export const CardPreview = memo(function CardPreview({
  previewUrl,
  label,
  previewUnavailableId,
  convertingId,
  isDownloading,
  copiedFormat,
  copyError,
  downloadError,
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
  prefersCoarsePointer = false,
  fetchPriority = "visible",
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

  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(fetchPriority === "active");

  useEffect(() => {
    if (!openHrefBase) {
      setIsInViewport(false);
      return;
    }

    if (fetchPriority === "active") {
      setIsInViewport(true);
      return;
    }

    const previewRoot = previewRootRef.current;
    if (!previewRoot) {
      setIsInViewport(true);
      return;
    }

    if (typeof IntersectionObserver !== "function") {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setIsInViewport(entries.some((entry) => entry.isIntersecting));
      },
      {
        root: null,
        rootMargin: PREVIEW_VIEWPORT_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(previewRoot);

    return () => {
      observer.disconnect();
    };
  }, [fetchPriority, openHrefBase]);

  const [showActions, setShowActions] = useState(false);
  const isPreviewActive =
    fetchPriority === "active" ||
    isAnyPopoverOpen ||
    showActions ||
    forceActionsVisible;
  const shouldLoadPreview =
    Boolean(openHrefBase) && (isPreviewActive || isInViewport);

  const { imageSrc, isLoading, error, refresh } = useCachedCardPreview(
    openHrefBase,
    {
      enabled: shouldLoadPreview,
      priority: isPreviewActive ? "active" : fetchPriority,
    },
  );

  const [lastRefreshToken, setLastRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    setLastRefreshToken(null);
  }, [openHrefBase]);

  const openHref = useMemo(
    () => (openHrefBase ? withCacheBust(openHrefBase, lastRefreshToken) : null),
    [openHrefBase, lastRefreshToken],
  );

  const handleRefresh = useCallback(() => {
    void (async () => {
      try {
        const token = await refresh();
        if (token) setLastRefreshToken(token);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to refresh preview:", error);
      }
    })();
  }, [refresh]);

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
  const isPreviewAvailable = Boolean(previewUrl);
  const shouldRenderFallbackSrc = Boolean(previewUrl && error);
  const resolvedSrc = imageSrc ?? (shouldRenderFallbackSrc ? previewUrl : null);
  const overlayPinned = isAnyPopoverOpen || showActions || forceActionsVisible;
  const showDesktopActionOverlay = !prefersCoarsePointer;
  const showReachableActionBar = prefersCoarsePointer;
  const overlayVisibilityClass = overlayPinned
    ? "opacity-100"
    : `
      opacity-0
      group-focus-within/card-preview:opacity-100
      group-hover/card-preview:opacity-100
    `;

  const renderPreviewNode = (): ReactNode => {
    if (!isPreviewAvailable) {
      return (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Eye className="size-8" />
        </div>
      );
    }

    if (!resolvedSrc && isLoading) {
      return (
        <div className={cn("size-full", paddingClass)}>
          <Skeleton className="size-full" />
          <span className="sr-only">Loading preview...</span>
        </div>
      );
    }

    if (resolvedSrc) {
      return (
        <img
          src={resolvedSrc}
          alt={`${label} preview`}
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 size-full object-contain blur-none brightness-100",
            paddingClass,
            "transition-all duration-300 ease-out will-change-[transform,filter]",
            "group-focus-within/card-preview:scale-[1.02] group-hover/card-preview:scale-[1.02]",
            "group-focus-within/card-preview:blur-[2px] group-hover/card-preview:blur-[2px]",
            `
              group-focus-within/card-preview:brightness-[0.7]
              group-hover/card-preview:brightness-[0.7]
            `,
          )}
          style={{ borderRadius: borderRadiusValue }}
        />
      );
    }

    return (
      <div className="flex size-full items-center justify-center text-muted-foreground">
        <LoadingSpinner
          size="md"
          className="text-muted-foreground"
          text={isLoading ? "Loading preview..." : "Preview unavailable"}
          liveRegion="off"
        />
      </div>
    );
  };

  const renderAvailabilityAnnouncements = () => (
    <>
      {isPreviewAvailable ? null : (
        <span id={previewUnavailableId} className="sr-only">
          Preview not available
        </span>
      )}
      {isDownloading ? (
        <span id={convertingId} className="sr-only">
          Preparing download...
        </span>
      ) : null}
    </>
  );

  const renderDesktopActionOverlay = () => {
    if (showDesktopActionOverlay) {
      return (
        <>
          {/* Subtle scrim for better hierarchy when actions appear */}
          <div
            aria-hidden="true"
            className={cn(
              `
                pointer-events-none absolute inset-0 hidden bg-linear-to-t from-black/15 via-black/0
                to-black/0
                md:block
              `,
              "transition-opacity duration-200",
              overlayVisibilityClass,
            )}
          />

          {/* Keyboard-only toggle for desktop — hidden visually but becomes visible when focused */}
          <button
            type="button"
            aria-label={`Toggle actions for ${label}`}
            aria-pressed={showActions}
            onClick={() => setShowActions((value) => !value)}
            className="
              pointer-events-none absolute top-2 right-2 z-20 hidden size-10 items-center
              justify-center rounded-full bg-white/10 text-white opacity-0
              focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2
              focus-visible:ring-white/70 focus-visible:outline-none
              md:inline-flex
            "
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>

          <div
            className={cn(
              `
                pointer-events-none absolute inset-0 hidden items-center justify-center gap-3
                transition-opacity duration-300
                md:flex
              `,
              overlayVisibilityClass,
            )}
          >
            <OpenInNewTabButton
              openHref={openHref}
              label={label}
              isPreviewAvailable={isPreviewAvailable}
              previewUnavailableId={previewUnavailableId}
            />

            <RefreshPreviewButton
              disabled={!previewUrl || isLoading}
              title={previewUrl ? "Refresh preview" : "Preview not available"}
              ariaLabel={`Refresh preview for ${label}`}
              onRefresh={handleRefresh}
            />

            {hideCopyDownload ? null : (
              <>
                <div className="pointer-events-auto">
                  <CopyPopover
                    open={copyPopoverOpen}
                    onOpenChange={setCopyPopoverOpen}
                    previewUrl={previewUrl}
                    copiedFormat={copiedFormat}
                    copyError={copyError}
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
                    downloadError={downloadError}
                    onDownload={onDownload}
                    downloadDescrId={downloadDescrId}
                    downloadTitle={downloadTitle}
                  />
                </div>
              </>
            )}
          </div>
        </>
      );
    }

    return null;
  };

  const renderReachableActionBar = () => {
    if (!showReachableActionBar) {
      return null;
    }

    return (
      <div className="border-t border-gold/10 p-2">
        <div className="grid grid-cols-2 gap-2">
          <OpenInNewTabButton
            openHref={openHref}
            label={label}
            isPreviewAvailable={isPreviewAvailable}
            previewUnavailableId={previewUnavailableId}
            className="h-11 w-full justify-center gap-2 rounded-xl px-3 shadow-none"
            iconClassName="size-4"
            visibleLabel="Open"
          />

          <RefreshPreviewButton
            disabled={!previewUrl || isLoading}
            title={previewUrl ? "Refresh preview" : "Preview not available"}
            ariaLabel={`Refresh preview for ${label}`}
            className="h-11 w-full justify-center gap-2 rounded-xl px-3 shadow-none"
            iconClassName="size-4"
            visibleLabel="Refresh"
            onRefresh={handleRefresh}
          />

          {hideCopyDownload ? null : (
            <>
              <CopyPopover
                open={copyPopoverOpen}
                onOpenChange={setCopyPopoverOpen}
                previewUrl={previewUrl}
                copiedFormat={copiedFormat}
                copyError={copyError}
                onCopyUrl={onCopyUrl}
                onCopyAniList={onCopyAniList}
                previewUnavailableId={previewUnavailableId}
                triggerClassName="h-11 w-full justify-center gap-2 rounded-xl px-3 shadow-none"
                triggerLabel="Copy"
              />

              <DownloadPopover
                open={downloadPopoverOpen}
                onOpenChange={setDownloadPopoverOpen}
                previewUrl={previewUrl}
                isDownloading={isDownloading}
                downloadError={downloadError}
                onDownload={onDownload}
                downloadDescrId={downloadDescrId}
                downloadTitle={downloadTitle}
                triggerClassName="h-11 w-full justify-center gap-2 rounded-xl px-3 shadow-none"
                triggerLabel="Download"
              />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gold/3 dark:bg-gold/2">
      <div
        ref={previewRootRef}
        data-tour="card-preview"
        className="group/card-preview relative aspect-2/1 overflow-hidden"
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
      >
        {renderPreviewNode()}
        {renderDesktopActionOverlay()}
        {renderAvailabilityAnnouncements()}
      </div>

      {renderReachableActionBar()}
    </div>
  );
});

CardPreview.displayName = "CardPreview";
