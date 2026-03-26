"use client";

import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import type { ConversionFormat } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DownloadPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  isDownloading: boolean;
  onDownload: (format: ConversionFormat) => Promise<void> | void;
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
          aria-label={isDownloading ? "Converting..." : "Download"}
          className={cn(
            triggerLabel
              ? "h-11 w-full justify-center gap-2 rounded-xl px-3 text-sm shadow-none"
              : "size-10 rounded-full p-0 shadow-lg transition-all",
            "border border-gold/20 bg-background/80 text-foreground backdrop-blur-sm",
            "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
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
            {isDownloading ? "Converting..." : "Download"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 border-gold/20 p-1.5 dark:border-gold/15"
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
            <span className="font-medium text-foreground">SVG</span>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
