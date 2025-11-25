"use client";

import { Card } from "@/components/user/card";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-spinner";
import { useState } from "react";
import {
  batchConvertAndZip,
  type BatchConversionProgress,
  type BatchExportCard,
  type ConversionFormat,
  copyToClipboard,
  getAbsoluteUrl,
} from "@/lib/utils";
import { trackBatchExport } from "@/lib/utils/google-analytics";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Download, Link } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Represents a single card entry used for rendering and exporting.
 * @property type - Display name for the card type.
 * @property svgUrl - URL of the SVG image for the card.
 * @property rawType - Original card identifier used for sorting and logic.
 * @source
 */
type CardType = BatchExportCard;

/**
 * Props for the CardList component.
 * @property cardTypes - Array of card entries to render.
 * @source
 */
interface CardListProps {
  cardTypes: CardType[];
}

const formatOptions: Array<{
  value: ConversionFormat;
  label: string;
}> = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

// Component for displaying a grid of cards with copyable SVG links
/**
 * Renders a grid of stat cards with bulk export/copy options.
 * @param props - Component properties.
 * @param props.cardTypes - The card entries to render as a grid.
 * @returns JSX element rendering a card grid and export UI.
 * @source
 */
export function CardList({ cardTypes }: Readonly<CardListProps>) {
  // Track which type of link was copied last (svg/anilist)
  const [copied, setCopied] = useState<string | null>(null);
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<BatchConversionProgress>(
    {
      current: 0,
      total: cardTypes.length,
      success: 0,
      failure: 0,
      cardIndex: 0,
    },
  );
  const [exportFormat, setExportFormat] = useState<ConversionFormat>("png");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const progressPercent = exportProgress.total
    ? Math.min(100, (exportProgress.current / exportProgress.total) * 100)
    : 0;

  // Generate different link formats for copy functionality
  /**
   * Absolute SVG links for each card, used in the direct SVG copy option.
   * @source
   */
  const svgLinks = cardTypes.map((card) => getAbsoluteUrl(card.svgUrl));
  /**
   * AniList bio-format links (img150) derived from absolute SVG URLs.
   * @source
   */
  const anilistBioLinks = cardTypes.map(
    (card) => `img150(${getAbsoluteUrl(card.svgUrl)})`,
  );

  // Extract userId from the first card's svgUrl using URL/URLSearchParams
  /**
   * Attempt to resolve a userId from the first card's svgUrl query params.
   * This is used to include a link back to the user's profile in the AniList format.
   * @source
   */
  const firstCardUrl = cardTypes[0]?.svgUrl;
  let userId: string | null = null;

  if (firstCardUrl) {
    try {
      const origin = globalThis.window?.location.origin ?? "http://localhost";
      const url = new URL(firstCardUrl, origin);
      userId = url.searchParams.get("userId");
    } catch (error) {
      // Gracefully handle malformed URLs, but log for debugging
      console.error("Failed to extract userId from card URL:", error);
      userId = null;
    }
  }

  /**
   * A formatted markdown link that points to the user's stats page when userId is present.
   * @source
   */
  const statsLink = userId
    ? `[<h1>Stats</h1>](https://anicards.alpha49.com/user?userId=${userId})`
    : "";

  /**
   * Copy all links in the requested format to the clipboard, and show temporary UI feedback.
   * @param type - Either 'svg' for direct SVG URLs or 'anilist' for AniList bio format.
   * @returns Promise<void>
   * @source
   */
  const handleCopyLinks = async (type: "svg" | "anilist") => {
    // If copying AniList format, prepend the user's stats link for context
    const links = type === "svg" ? svgLinks : [statsLink, ...anilistBioLinks];
    await copyToClipboard(links.join("\n")); // Join array with newlines
    setCopied(type);
    setTimeout(() => setCopied(null), 2000); // Reset copied state after 2s
  };

  const handleBatchExport = async () => {
    if (cardTypes.length === 0) {
      setExportMessage("No cards available for export.");
      setTimeout(() => setExportMessage(null), 4000);
      return;
    }

    setIsBatchExporting(true);
    setExportProgress({
      current: 0,
      total: cardTypes.length,
      success: 0,
      failure: 0,
      cardIndex: 0,
    });
    setExportMessage(null);

    let exportedCount = 0;
    try {
      const summary = await batchConvertAndZip(
        cardTypes,
        exportFormat,
        (progress) => setExportProgress(progress),
      );
      exportedCount = summary.exported;
      const pluralSuffix = exportedCount === 1 ? "" : "s";
      setExportMessage(
        exportedCount > 0
          ? `Exported ${exportedCount} card${pluralSuffix} as ${exportFormat.toUpperCase()}.`
          : "No cards were exported.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Batch export failed.";
      setExportMessage(message);
    } finally {
      trackBatchExport(exportFormat, exportedCount, exportedCount > 0);
      setIsBatchExporting(false);
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-7xl">
      {isBatchExporting && (
        <LoadingOverlay
          text={`Converting ${exportProgress.current}/${exportProgress.total} cards...`}
        >
          <div className="w-full max-w-xs space-y-2 text-center">
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {exportProgress.success} succeeded • {exportProgress.failure}{" "}
              failed
            </p>
          </div>
        </LoadingOverlay>
      )}
      {/* Header Section with Copy Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex justify-center"
      >
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/20">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-2">
              <Link className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export Your Cards
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Copy links in different formats for sharing
              </p>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
                  aria-label="Copy all card links in bulk for multiple formats"
                >
                  <Link className="mr-2 h-4 w-4" />
                  Copy All Links
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
                <div className="space-y-4">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Export Options
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Choose the format that works best for your needs
                    </p>
                  </div>

                  {/* SVG links copy section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Direct SVG Links
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200/50 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50">
                      <textarea
                        className="w-full resize-none border-none bg-transparent text-xs text-gray-600 outline-none dark:text-gray-400"
                        value={svgLinks.join("\n")}
                        readOnly
                        rows={3}
                      />
                      <Button
                        onClick={() => handleCopyLinks("svg")}
                        size="sm"
                        className="mt-2 w-full"
                        aria-label="Copy all SVG links to clipboard"
                      >
                        {copied === "svg" ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Link className="mr-2 h-4 w-4" />
                            Copy SVG Links
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Anilist bio format copy section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        AniList Bio Format
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200/50 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50">
                      <textarea
                        className="w-full resize-none border-none bg-transparent text-xs text-gray-600 outline-none dark:text-gray-400"
                        value={[statsLink, ...anilistBioLinks].join("\n")}
                        readOnly
                        rows={4}
                      />
                      <Button
                        onClick={() => handleCopyLinks("anilist")}
                        size="sm"
                        className="mt-2 w-full"
                        aria-label="Copy all AniList bio format links to clipboard"
                      >
                        {copied === "anilist" ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Link className="mr-2 h-4 w-4" />
                            Copy AniList Format
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white transition-all duration-300 hover:from-emerald-600 hover:to-teal-500 hover:shadow-lg"
                  aria-label="Download all cards as a ZIP archive"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Batch Export
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Choose a format and bundle all cards in one ZIP file.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {formatOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant={
                          exportFormat === option.value ? "default" : "outline"
                        }
                        className="flex-col gap-1 text-xs font-semibold"
                        onClick={() => setExportFormat(option.value)}
                      >
                        <span className="text-sm">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={handleBatchExport}
                    className="w-full"
                    disabled={isBatchExporting || cardTypes.length === 0}
                  >
                    Start Export
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {exportMessage && (
            <p className="mt-2 text-center text-sm text-emerald-500 dark:text-emerald-300">
              {exportMessage}
            </p>
          )}
        </div>
      </motion.div>

      {/* Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cardTypes.map((card, index) => (
          <motion.div
            key={card.rawType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card {...card} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
