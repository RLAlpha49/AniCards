"use client";

import { Download, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
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
          className={cn(
            "h-9 gap-1.5 rounded-lg border-2 px-3 font-medium transition-all",
            "border-blue-200 bg-blue-50/50 text-blue-700 hover:border-blue-300 hover:bg-blue-100",
            "dark:border-blue-700/50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-blue-950/50",
            "disabled:opacity-70",
          )}
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">
                {downloadProgress.current}/{downloadProgress.total}
              </span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Download</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-40 p-1.5" align="center" side="top">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => void handleDownloadAll("png")}
          >
            <span className="font-medium text-slate-700 dark:text-slate-200">
              PNG
            </span>
            <span className="ml-auto text-xs text-slate-500">Lossless</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => void handleDownloadAll("webp")}
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
