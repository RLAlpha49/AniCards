"use client";

import { Check, Copy, ImageIcon, Link } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

interface CopyPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  copiedFormat: "url" | "anilist" | "failed-list" | null;
  onCopyUrl: () => Promise<void> | void;
  onCopyAniList: () => Promise<void> | void;
  previewUnavailableId?: string;
}

export function CopyPopover({
  open,
  onOpenChange,
  previewUrl,
  copiedFormat,
  onCopyUrl,
  onCopyAniList,
  previewUnavailableId,
}: Readonly<CopyPopoverProps>) {
  const srCopiedMessage = (() => {
    if (copiedFormat === "url") return "Copied URL to clipboard";
    if (copiedFormat === "anilist") return "Copied AniList format to clipboard";
    if (copiedFormat) return "Copied to clipboard";
    return "";
  })();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-tour="card-copy"
          disabled={!previewUrl}
          aria-disabled={!previewUrl}
          aria-describedby={previewUrl ? undefined : previewUnavailableId}
          title={previewUrl ? undefined : "Preview not available"}
          className={cn(
            "h-10 w-10 rounded-full p-0 shadow-lg transition-all",
            "border-gold/20 bg-background/80 text-foreground border backdrop-blur-sm",
            "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
            copiedFormat &&
              "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
            !previewUrl && "cursor-not-allowed opacity-80",
          )}
        >
          {copiedFormat ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Copy className="h-5 w-5" aria-hidden="true" />
          )}
          <span className="sr-only">
            {copiedFormat ? "Copied" : "Copy URL"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="border-gold/20 dark:border-gold/15 w-48 p-1.5"
        align="center"
      >
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-gold/5 dark:hover:bg-gold/5 h-9 justify-start gap-2 px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onCopyUrl}
            disabled={!previewUrl}
            aria-disabled={!previewUrl}
            aria-describedby={previewUrl ? undefined : previewUnavailableId}
            title={previewUrl ? undefined : "Preview not available"}
          >
            <Link
              className="text-gold-dim dark:text-gold h-4 w-4"
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
            className="hover:bg-gold/5 dark:hover:bg-gold/5 h-9 justify-start gap-2 px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onCopyAniList}
            disabled={!previewUrl}
            aria-disabled={!previewUrl}
            aria-describedby={previewUrl ? undefined : previewUnavailableId}
            title={previewUrl ? undefined : "Preview not available"}
          >
            <ImageIcon
              className="text-gold-dim dark:text-gold h-4 w-4"
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
              {srCopiedMessage}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
