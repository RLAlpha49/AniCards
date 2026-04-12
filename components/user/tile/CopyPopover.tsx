"use client";

import { AlertCircle, Check, Copy, ImageIcon, Link } from "lucide-react";

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
  copyError?: string | null;
  onCopyUrl: () => Promise<void> | void;
  onCopyAniList: () => Promise<void> | void;
  previewUnavailableId?: string;
  triggerClassName?: string;
  triggerLabel?: string;
}

export function CopyPopover({
  open,
  onOpenChange,
  previewUrl,
  copiedFormat,
  copyError,
  onCopyUrl,
  onCopyAniList,
  previewUnavailableId,
  triggerClassName,
  triggerLabel,
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
            triggerLabel
              ? "h-11 w-full justify-center gap-2 rounded-xl px-3 text-sm shadow-none"
              : "size-10 rounded-full p-0 shadow-lg transition-all",
            "border border-gold/20 bg-background/80 text-foreground backdrop-blur-sm",
            "hover:border-gold/40 hover:bg-background/90 hover:shadow-gold/15",
            copiedFormat &&
              "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
            copyError &&
              `
                border-red-300/50 bg-red-50/80 text-red-700
                dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300
              `,
            !previewUrl && "cursor-not-allowed opacity-80",
            triggerClassName,
          )}
        >
          {copiedFormat ? (
            <Check className="size-5" aria-hidden="true" />
          ) : (
            <Copy className="size-5" aria-hidden="true" />
          )}
          {triggerLabel ? (
            <span>{copiedFormat ? "Copied" : triggerLabel}</span>
          ) : null}
          <span className="sr-only">
            {copiedFormat ? "Copied" : "Copy URL"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          copyError ? "w-64" : "w-48",
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
            onClick={onCopyUrl}
            disabled={!previewUrl}
            aria-disabled={!previewUrl}
            aria-describedby={previewUrl ? undefined : previewUnavailableId}
            title={previewUrl ? undefined : "Preview not available"}
          >
            <Link
              className="size-4 text-gold-dim dark:text-gold"
              aria-hidden="true"
            />
            <span>Copy URL</span>
            {copiedFormat === "url" && (
              <Check
                className="ml-auto size-4 text-green-600"
                aria-hidden="true"
              />
            )}
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
            onClick={onCopyAniList}
            disabled={!previewUrl}
            aria-disabled={!previewUrl}
            aria-describedby={previewUrl ? undefined : previewUnavailableId}
            title={previewUrl ? undefined : "Preview not available"}
          >
            <ImageIcon
              className="size-4 text-gold-dim dark:text-gold"
              aria-hidden="true"
            />
            <span>AniList Format</span>
            {copiedFormat === "anilist" && (
              <Check
                className="ml-auto size-4 text-green-600"
                aria-hidden="true"
              />
            )}
          </Button>

          {copiedFormat && (
            <span aria-live="polite" className="sr-only">
              {srCopiedMessage}
            </span>
          )}

          {copyError ? (
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
                    Copy didn&apos;t work
                  </p>
                  <p className="mt-1 leading-relaxed">
                    Try again, or open the preview in a new tab and copy from
                    there.
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
