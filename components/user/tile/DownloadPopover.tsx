"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";

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
            "h-8 gap-1.5 rounded-full px-3 text-sm font-medium shadow-lg transition-all",
            "border-2 border-white/80 bg-white/20 text-white backdrop-blur-sm",
            "hover:border-white hover:bg-white/30",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Converting...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1.5" align="center">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-slate-800"
            onClick={() => onDownload("png")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="font-medium text-slate-700 dark:text-slate-200">
              PNG
            </span>
            <span className="ml-auto text-xs text-slate-500">Lossless</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-slate-800"
            onClick={() => onDownload("webp")}
            disabled={!previewUrl || isDownloading}
            aria-describedby={downloadDescrId}
            title={downloadTitle}
          >
            <span className="font-medium text-slate-700 dark:text-slate-200">
              WebP
            </span>
            <span className="ml-auto text-xs text-slate-500">Smaller</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
