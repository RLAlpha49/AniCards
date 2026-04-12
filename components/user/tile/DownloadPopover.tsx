"use client";

import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import type { CardDownloadFormat } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DownloadPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  isDownloading: boolean;
  downloadError?: string | null;
  onDownload: (format: CardDownloadFormat) => Promise<void> | void;
  downloadDescrId?: string;
  downloadTitle?: string;
  triggerClassName?: string;
  triggerLabel?: string;
}

export function DownloadPopover({
  open,
  onOpenChange,
  previewUrl,
  isDownloading,
  downloadError,
  onDownload,
  downloadDescrId,
  downloadTitle,
  triggerClassName,
  triggerLabel,
}: Readonly<DownloadPopoverProps>) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-tour="card-download"
          disabled={!previewUrl || isDownloading}
          aria-describedby={downloadDescrId}
          title={downloadTitle}
          aria-label={isDownloading ? "Preparing download..." : "Download"}
          className={cn(
            triggerLabel
              ? "h-11 w-full justify-center gap-2 rounded-xl px-3 text-sm shadow-none"
              : "size-10 rounded-full p-0 shadow-lg transition-all",
            "border border-gold/20 bg-background/80 text-foreground backdrop-blur-sm",
            "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
            downloadError &&
              `
                border-red-300/50 bg-red-50/80 text-red-700
                dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300
              `,
            "disabled:cursor-not-allowed disabled:opacity-70",
            triggerClassName,
          )}
        >
          {isDownloading ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-5" aria-hidden="true" />
          )}
          {triggerLabel ? <span>{triggerLabel}</span> : null}
          <span className="sr-only">
            {isDownloading ? "Preparing download..." : "Download"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          downloadError ? "w-64" : "w-44",
          "border-gold/20 p-1.5 dark:border-gold/15",
        )}
        align="center"
      >
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="
              h-9 justify-start gap-2 px-2.5 text-sm
              hover:bg-gold/5
              disabled:cursor-not-allowed disabled:opacity-70
              dark:hover:bg-gold/5
            "
            onClick={() => onDownload("png")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="font-medium text-foreground">PNG</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Lossless
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="
              h-9 justify-start gap-2 px-2.5 text-sm
              hover:bg-gold/5
              disabled:cursor-not-allowed disabled:opacity-70
              dark:hover:bg-gold/5
            "
            onClick={() => onDownload("webp")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="font-medium text-foreground">WebP</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Smaller
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="
              h-9 justify-start gap-2 px-2.5 text-sm
              hover:bg-gold/5
              disabled:cursor-not-allowed disabled:opacity-70
              dark:hover:bg-gold/5
            "
            onClick={() => onDownload("svg")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="font-medium text-foreground">SVG</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Vector
            </span>
          </Button>

          {downloadError ? (
            <div
              role="status"
              aria-live="polite"
              className="
                mt-1 rounded-md border border-red-200/60 bg-red-50/80 p-2 text-xs text-red-700
                dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300
              "
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Download didn&apos;t start
                  </p>
                  <p className="mt-1 leading-relaxed">
                    Try again, choose another format, or refresh the preview
                    first.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
