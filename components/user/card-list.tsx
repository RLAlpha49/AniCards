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
import { Check, Download, Link, Copy, FileArchive } from "lucide-react";
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

/**
 * Renders a grid of stat cards with bulk export/copy options.
 * @param props - Component properties.
 * @param props.cardTypes - The card entries to render as a grid.
 * @returns JSX element rendering a card grid and export UI.
 * @source
 */
export function CardList({ cardTypes }: Readonly<CardListProps>) {
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

  /**
   * Attempt to resolve a userId from the first card's svgUrl query params.
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
    const links = type === "svg" ? svgLinks : [statsLink, ...anilistBioLinks];
    await copyToClipboard(links.join("\n"));
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
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
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-green-500">
                {exportProgress.success}
              </span>{" "}
              succeeded •{" "}
              <span className="font-medium text-red-500">
                {exportProgress.failure}
              </span>{" "}
              failed
            </p>
          </div>
        </LoadingOverlay>
      )}

      {/* Export Actions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              {/* Section Header */}
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 p-3 shadow-lg">
                  <Copy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Export Your Cards
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Copy links or download in bulk
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {/* Copy Links Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className="group rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
                      aria-label="Copy all card links in bulk for multiple formats"
                    >
                      <Link className="mr-2 h-4 w-4" />
                      Copy Links
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] rounded-2xl border-slate-200/50 bg-white/95 p-5 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-800/95">
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                          Export Options
                        </h4>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Choose the format that works best for you
                        </p>
                      </div>

                      {/* SVG Links */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Direct SVG Links
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                          <textarea
                            className="w-full resize-none border-none bg-transparent text-xs text-slate-600 outline-none dark:text-slate-400"
                            value={svgLinks.join("\n")}
                            readOnly
                            rows={3}
                          />
                          <Button
                            onClick={() => handleCopyLinks("svg")}
                            size="sm"
                            className="mt-2 w-full rounded-lg"
                            aria-label="Copy SVG links to clipboard"
                          >
                            {copied === "svg" ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy SVG Links
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* AniList Format */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            AniList Bio Format
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                          <textarea
                            className="w-full resize-none border-none bg-transparent text-xs text-slate-600 outline-none dark:text-slate-400"
                            value={[statsLink, ...anilistBioLinks].join("\n")}
                            readOnly
                            rows={4}
                          />
                          <Button
                            onClick={() => handleCopyLinks("anilist")}
                            size="sm"
                            className="mt-2 w-full rounded-lg"
                            aria-label="Copy AniList bio format links to clipboard"
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

                {/* Download All Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className="group rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
                      aria-label="Download all cards as a ZIP archive"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download All
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 rounded-2xl border-slate-200/50 bg-white/95 p-5 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-800/95">
                    <div className="space-y-5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                          <FileArchive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            Batch Export
                          </h4>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            Download all cards as a ZIP file
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Select Format
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {formatOptions.map((option) => (
                            <Button
                              key={option.value}
                              variant={
                                exportFormat === option.value
                                  ? "default"
                                  : "outline"
                              }
                              className={`rounded-lg font-semibold transition-all ${
                                exportFormat === option.value
                                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                  : ""
                              }`}
                              onClick={() => setExportFormat(option.value)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleBatchExport}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
                        disabled={isBatchExporting || cardTypes.length === 0}
                      >
                        {isBatchExporting ? "Exporting..." : "Start Export"}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Export Message */}
            {exportMessage && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400"
              >
                {exportMessage}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cardTypes.map((card, index) => (
          <motion.div
            key={card.rawType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
          >
            <Card {...card} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
