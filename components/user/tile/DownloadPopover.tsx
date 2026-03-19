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
}

export function DownloadPopover({
  open,
  onOpenChange,
  previewUrl,
  isDownloading,
  onDownload,
  downloadDescrId,
  downloadTitle,
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
            "h-10 w-10 rounded-full p-0 shadow-lg transition-all",
            "border-gold/20 bg-background/80 text-foreground border backdrop-blur-sm",
            "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {isDownloading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-5 w-5" aria-hidden="true" />
          )}
          <span className="sr-only">
            {isDownloading ? "Converting..." : "Download"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="border-gold/20 dark:border-gold/15 w-40 p-1.5"
        align="center"
      >
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-gold/5 dark:hover:bg-gold/5 h-9 justify-start gap-2 rounded-md px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onDownload("png")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="text-foreground font-medium">SVG</span>
            <span className="text-muted-foreground ml-auto text-xs">
              Lossless
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-gold/5 dark:hover:bg-gold/5 h-9 justify-start gap-2 rounded-md px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onDownload("webp")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="text-foreground font-medium">WebP</span>
            <span className="text-muted-foreground ml-auto text-xs">
              Smaller
            </span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
