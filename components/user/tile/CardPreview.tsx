"use client";

import Image from "next/image";
import { Eye } from "lucide-react";
import { CopyPopover } from "@/components/user/tile/CopyPopover";
import { DownloadPopover } from "@/components/user/tile/DownloadPopover";
import { cn, type ConversionFormat } from "@/lib/utils";

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
