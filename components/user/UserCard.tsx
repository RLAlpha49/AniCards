/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { Download, Link, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  svgToPng,
  copyToClipboard,
  cn,
  getAbsoluteUrl,
  DEFAULT_CARD_BORDER_RADIUS,
  getSvgBorderRadius,
  clampBorderRadius,
  type ConversionFormat,
} from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { motion } from "framer-motion";

import { displayNames } from "@/lib/card-data/validation";
import {
  trackCardDownload,
  trackCopyAction,
  safeTrack,
} from "@/lib/utils/google-analytics";

const downloadFormatOptions: ReadonlyArray<{
  label: string;
  value: ConversionFormat;
}> = [
  { label: "PNG", value: "png" },
  { label: "WebP", value: "webp" },
];

/**
 * Props for the Card component.
 * @property type - The card type key used for labeling and tracking.
 * @property svgUrl - The URL (absolute or relative) pointing to the card's SVG.
 * @source
 */
interface CardProps {
  type: string;
  svgUrl: string;
  borderRadius?: number;
}

/**
 * Renders an interactive stat card preview with download and link-copy actions.
 * @param props - Component properties.
 * @param props.type - Card type key used to display a friendly name and for analytics.
 * @param props.svgUrl - The SVG URL to display and convert for download/copy.
 * @returns JSX element that displays the card preview and actions.
 * @source
 */
export function Card({ type, svgUrl, borderRadius }: Readonly<CardProps>) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cardBorderRadius, setCardBorderRadius] = useState(() =>
    clampBorderRadius(borderRadius ?? DEFAULT_CARD_BORDER_RADIUS),
  );

  // Add cache-busting timestamp to force SVG reload. Prefer a timestamp provided
  // in the svgUrl (via `_t=`) and fall back to a local per-instance timestamp.
  const cacheBustedSvgUrl = useMemo(() => {
    if (svgUrl.includes("_t=")) return svgUrl;
    return `${svgUrl}${svgUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`;
  }, [svgUrl]);

  useEffect(() => {
    if (!svgUrl) {
      return undefined;
    }
    if (typeof borderRadius === "number") {
      // We have a configured border radius, no need to fetch the SVG.
      return undefined;
    }

    let isCancelled = false;

    const fetchBorderRadius = async () => {
      try {
        const parsed = await getSvgBorderRadius(cacheBustedSvgUrl);
        if (parsed !== null && !isCancelled)
          setCardBorderRadius(clampBorderRadius(parsed));
      } catch (error) {
        console.error("Unable to determine card border radius", error);
      }
    };

    void fetchBorderRadius();

    return () => {
      isCancelled = true;
    };
  }, [svgUrl, borderRadius, cacheBustedSvgUrl]);

  /**
   * Convert the currently displayed SVG to a PNG URL and trigger a browser download.
   * @returns Promise<void>
   * @source
   */
  const handleDownload = async (fmt: ConversionFormat = "png") => {
    const url = await svgToPng(cacheBustedSvgUrl, fmt);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}.${fmt}`;
    link.click();
    safeTrack(() => trackCardDownload(`${type}_${fmt}`));
  };

  /**
   * Copy a given text to the clipboard and show brief feedback to the user.
   * @param text - The text to copy to clipboard.
   * @param label - Identifier for the format (e.g., 'svg', 'anilist').
   * @returns Promise<void>
   * @source
   */
  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    safeTrack(() => trackCopyAction(`${label}_${type}`));
  };

  /**
   * Strip the _t timestamp parameter from a URL for clean copy links.
   * @source
   */
  const stripTimestampParam = (url: string): string => {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete("_t");
      return urlObj.toString();
    } catch {
      // If URL parsing fails, try regex fallback
      return url.replaceAll(/[&?]_t=\d+/g, "");
    }
  };

  /**
   * Absolute URL for the displayed SVG (suitable for sharing/copying).
   * Strips _t timestamp param for clean URLs.
   * @source
   */
  const svgLink = stripTimestampParam(getAbsoluteUrl(cacheBustedSvgUrl));
  /**
   * AniList bio format (img150) using the absolute SVG URL.
   * Strips _t timestamp param for clean URLs.
   * @source
   */
  const anilistBioLink = `img150(${stripTimestampParam(getAbsoluteUrl(cacheBustedSvgUrl))})`;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative h-full"
    >
      <div className="flex h-full flex-col rounded-2xl border border-slate-200/50 bg-white/80 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-slate-300/50 hover:shadow-xl dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:border-slate-600/50">
        {/* Card Header */}
        <div className="border-b border-slate-200/50 p-5 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {displayNames[type] || type}
          </h3>
          <div className="mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        </div>

        {/* Card Image */}
        <div className="flex-1 p-5">
          <div
            className="relative overflow-hidden rounded-xl bg-slate-100/50 dark:bg-slate-900/50"
            style={{
              aspectRatio: "auto",
              borderRadius: Math.max(0, cardBorderRadius - 2),
            }}
          >
            <img
              src={cacheBustedSvgUrl || "/placeholder.svg"}
              alt={type}
              width={400}
              height={600}
              style={{
                width: "100%",
                height: "auto",
                maxWidth: "400px",
                borderRadius: Math.max(0, cardBorderRadius - 2),
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              className={cn(
                "mx-auto transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100",
              )}
            />

            {/* Loading overlay */}
            {isLoading && (
              <div
                className="absolute inset-0 flex min-h-[200px] items-center justify-center"
                style={{ borderRadius: Math.max(0, cardBorderRadius - 2) }}
              >
                <LoadingSpinner
                  size="md"
                  className="text-blue-500"
                  text="Loading card..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t border-slate-200/50 p-5 dark:border-slate-700/50">
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {/* Download Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="w-full min-w-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-medium text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg sm:w-auto sm:flex-1"
                  aria-label={`Choose a download format for ${displayNames[type] || type} card`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 rounded-2xl border-slate-200/50 bg-white/95 p-5 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-800/95">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                      <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        Download Format
                      </h4>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        Choose your preferred format
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {downloadFormatOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant="outline"
                        className="rounded-lg font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
                        onClick={() => {
                          void handleDownload(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Copy Link Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full min-w-0 rounded-xl border-slate-200 font-medium transition-all hover:scale-[1.02] hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 sm:w-auto sm:flex-1"
                  aria-label={`Copy ${displayNames[type]} card links in various formats`}
                >
                  <Link className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 rounded-2xl border-slate-200/50 bg-white/95 p-5 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-800/95">
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                      <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        Copy Options
                      </h4>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        Choose your preferred format
                      </p>
                    </div>
                  </div>

                  {/* SVG Link */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Direct SVG Link
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                      <input
                        className="w-full truncate border-none bg-transparent text-xs text-slate-600 outline-none dark:text-slate-400"
                        value={svgLink}
                        readOnly
                      />
                      <Button
                        onClick={() => handleCopy(svgLink, "svg")}
                        size="sm"
                        className="mt-2 w-full rounded-lg"
                        aria-label="Copy SVG link to clipboard"
                      >
                        {copied === "svg" ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy SVG Link
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* AniList Format */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        AniList Bio Format
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                      <input
                        className="w-full truncate border-none bg-transparent text-xs text-slate-600 outline-none dark:text-slate-400"
                        value={anilistBioLink}
                        readOnly
                      />
                      <Button
                        onClick={() => handleCopy(anilistBioLink, "anilist")}
                        size="sm"
                        className="mt-2 w-full rounded-lg"
                        aria-label="Copy AniList bio format link to clipboard"
                      >
                        {copied === "anilist" ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy AniList Format
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
