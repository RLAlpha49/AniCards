"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { cn, type ConversionFormat } from "@/lib/utils";

interface DownloadPopoverProps {
  isDownloading: boolean;
  downloadProgress: { current: number; total: number };
  handleDownloadAll: (format?: ConversionFormat) => Promise<void> | void;
}

/**
 * Pure UI popover for download format selection. The parent manages state and handlers.
 */
export function DownloadPopover({
  isDownloading,
  downloadProgress,
  handleDownloadAll,
}: Readonly<DownloadPopoverProps>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isDownloading}
          aria-label={
            isDownloading
              ? `Downloading ${downloadProgress.current} of ${downloadProgress.total}`
              : "Download cards"
          }
          className={cn(
            "h-9 gap-1.5 border-2 px-3 font-medium transition-all",
            "border-gold/25 bg-gold/5 text-gold-dim hover:border-gold/30 hover:bg-gold/10",
            `
              dark:border-gold/20 dark:bg-gold/5 dark:text-gold
              dark:hover:border-gold/30 dark:hover:bg-gold/10
            `,
            "disabled:opacity-70",
          )}
        >
          {isDownloading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline" aria-hidden="true">
                {downloadProgress.current}/{downloadProgress.total}
              </span>
            </>
          ) : (
            <>
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Download</span>
              <ChevronDown className="size-3" aria-hidden="true" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      {isDownloading && (
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          Downloading {downloadProgress.current} of {downloadProgress.total}
        </span>
      )}

      <PopoverContent className="w-40 p-1.5" align="center" side="top">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 px-2.5 text-sm hover:bg-gold/5 dark:hover:bg-gold/5"
            disabled={isDownloading}
            onClick={() => {
              handleDownloadAll("png");
            }}
          >
            <span className="font-medium text-foreground">PNG</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Lossless
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 px-2.5 text-sm hover:bg-gold/5 dark:hover:bg-gold/5"
            disabled={isDownloading}
            onClick={() => {
              handleDownloadAll("webp");
            }}
          >
            <span className="font-medium text-foreground">WebP</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Smaller
            </span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
