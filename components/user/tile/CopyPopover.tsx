"use client";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Link, ImageIcon, Check, Copy, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  copiedFormat: "url" | "anilist" | null;
  onCopyUrl: () => Promise<void> | void;
  onCopyAniList: () => Promise<void> | void;
  previewUnavailableId?: string;
  isAnyPopoverOpen?: boolean;
}

export function CopyPopover({
  open,
  onOpenChange,
  previewUrl,
  copiedFormat,
  onCopyUrl,
  onCopyAniList,
  previewUnavailableId,
  isAnyPopoverOpen = false,
}: Readonly<CopyPopoverProps>) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!previewUrl}
          aria-disabled={!previewUrl}
          aria-describedby={previewUrl ? undefined : previewUnavailableId}
          title={previewUrl ? undefined : "Preview not available"}
          className={cn(
            "h-8 gap-1.5 rounded-full px-3 text-sm font-medium shadow-lg transition-all",
            copiedFormat
              ? "bg-green-500 text-white shadow-green-500/25 hover:bg-green-600"
              : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-purple-500/25 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30",
            isAnyPopoverOpen && "opacity-100",
            !previewUrl && "cursor-not-allowed opacity-80",
          )}
        >
          {copiedFormat ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Copy URL</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1.5" align="center">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-blue-950/50"
            onClick={onCopyUrl}
            disabled={!previewUrl}
            aria-disabled={!previewUrl}
            aria-describedby={previewUrl ? undefined : previewUnavailableId}
            title={previewUrl ? undefined : "Preview not available"}
          >
            <Link
              className="h-4 w-4 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span>Copy URL</span>
            {copiedFormat === "url" && (
              <Check
                className="ml-auto h-4 w-4 text-green-600"
                aria-hidden="true"
              />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-purple-950/50"
            onClick={onCopyAniList}
            disabled={!previewUrl}
            aria-disabled={!previewUrl}
            aria-describedby={previewUrl ? undefined : previewUnavailableId}
            title={previewUrl ? undefined : "Preview not available"}
          >
            <ImageIcon
              className="h-4 w-4 text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
            <span>AniList Format</span>
            {copiedFormat === "anilist" && (
              <Check
                className="ml-auto h-4 w-4 text-green-600"
                aria-hidden="true"
              />
            )}
          </Button>

          {copiedFormat && (
            <span aria-live="polite" className="sr-only">
              {copiedFormat === "url"
                ? "Copied URL to clipboard"
                : "Copied AniList format to clipboard"}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
