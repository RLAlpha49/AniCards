"use client";

import { Check, ChevronDown,Copy, ImageIcon, Link } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

interface CopyUrlsPopoverProps {
  copiedFormat: "url" | "anilist" | "failed-list" | null;
  handleCopyUrls: (format: "url" | "anilist") => Promise<void> | void;
}

/**
 * Pure UI popover for selecting copy format. All state/handlers live in the parent.
 */
export function CopyUrlsPopover({
  copiedFormat,
  handleCopyUrls,
}: Readonly<CopyUrlsPopoverProps>) {
  const ariaLabel = (() => {
    if (copiedFormat === "url") return "URLs copied to clipboard";
    if (copiedFormat === "anilist") return "AniList format copied to clipboard";
    if (copiedFormat) return "Copied to clipboard";
    return "Copy card URLs";
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={ariaLabel}
          className={cn(
            "h-9 gap-1.5 rounded-lg px-3 font-medium shadow-md transition-all",
            copiedFormat
              ? "bg-green-500 text-white shadow-green-500/25 hover:bg-green-600"
              : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-purple-500/25 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/30",
          )}
        >
          {copiedFormat ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Copy URLs</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-48 p-1.5" align="center" side="top">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/50"
            onClick={() => {
              handleCopyUrls("url");
            }}
          >
            <Link
              className="h-4 w-4 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span>Raw URLs</span>
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
            className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-purple-50 dark:hover:bg-purple-950/50"
            onClick={() => {
              handleCopyUrls("anilist");
            }}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
