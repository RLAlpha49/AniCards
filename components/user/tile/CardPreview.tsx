"use client";

import Image from "next/image";
import { Eye, ExternalLink } from "lucide-react";
import { CopyPopover } from "@/components/user/tile/CopyPopover";
import { DownloadPopover } from "@/components/user/tile/DownloadPopover";
import { cn, type ConversionFormat } from "@/lib/utils";

function toCardApiHref(previewUrl: string): string | null {
  try {
    const url = new URL(previewUrl, "https://example.local");

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
  copiedFormat: "url" | "anilist" | null;
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

export function CardPreview({
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

  return (
    <div className="relative aspect-[2/1] overflow-hidden bg-slate-100 dark:bg-slate-900">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={`${label} preview`}
          fill
          className="object-contain p-2"
          style={{ borderRadius: borderRadiusValue }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <Eye className="h-8 w-8" />
        </div>
      )}

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
          isAnyPopoverOpen
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
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
}
