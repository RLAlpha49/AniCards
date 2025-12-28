"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Download,
  CheckSquare,
  ChevronDown,
  Loader2,
  Link,
  ImageIcon,
  Check,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/Alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  useUserPageEditor,
  type CardEditorConfig,
} from "@/lib/stores/user-page-editor";
import {
  cn,
  batchConvertAndZip,
  type ConversionFormat,
  type BatchExportCard,
} from "@/lib/utils";
import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import { useSidebar } from "@/components/ui/Sidebar";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Props for BulkActionsToolbar.
 * @source
 */
interface BulkActionsToolbarProps {
  /** Additional className for the toolbar container */
  className?: string;
}

/**
 * Floating toolbar that appears when cards are selected.
 * Provides bulk copy and download operations.
 * @source
 */
export function BulkActionsToolbar({
  className,
}: Readonly<BulkActionsToolbarProps>) {
  const [copiedFormat, setCopiedFormat] = useState<"url" | "anilist" | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
  });

  // Local UI state for surfaced download results or errors
  const [downloadSummary, setDownloadSummary] = useState<{
    total: number;
    exported: number;
    failed: number;
    failedCardRawTypes?: string[];
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadSummaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if component is mounted for SSR-safe portal rendering
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state after hydration to enable portal rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cleanup timers on unmount to avoid state updates after the component unmounts
  useEffect(() => {
    return () => {
      if (downloadSummaryTimerRef.current) {
        clearTimeout(downloadSummaryTimerRef.current);
        downloadSummaryTimerRef.current = null;
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);
  const {
    userId,
    selectedCardIds,
    cardConfigs,
    globalColorPreset,
    clearSelection,
    selectAllEnabled,
    getEffectiveColors,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
    globalAdvancedSettings,
  } = useUserPageEditor();

  // Mirror the LayoutShell main margin-left behavior so the portaled toolbar
  // remains centered relative to the main content area (not the full viewport).
  const { open } = useSidebar();
  const isMobile = useIsMobile();

  const sidebarOffset = useMemo(() => {
    if (isMobile) return "0px";
    return open ? "10rem" : "3rem";
  }, [isMobile, open]);

  const toolbarBottom = "calc(1.5rem + env(safe-area-inset-bottom))";
  const toolbarGutter = "1rem";

  const selectedCount = selectedCardIds.size;

  // Get selected card configurations with their URLs
  const selectedCards = useMemo(() => {
    if (!userId) return [];

    return Array.from(selectedCardIds)
      .map((cardId) => {
        const config = cardConfigs[cardId];
        if (!config?.enabled) return null;

        const effectiveColors = getEffectiveColors(cardId);
        const effectiveBorderColor = getEffectiveBorderColor(cardId);
        const effectiveBorderRadius = getEffectiveBorderRadius(cardId);
        const effectiveColorPreset = config.colorOverride.useCustomSettings
          ? config.colorOverride.colorPreset || "custom"
          : globalColorPreset;
        const urlColorPreset =
          effectiveColorPreset === "custom" ? undefined : effectiveColorPreset;

        const urlParams = mapStoredConfigToCardUrlParams(
          {
            cardName: cardId,
            variation: config.variant,
            colorPreset: urlColorPreset,
            titleColor: effectiveColors[0],
            backgroundColor: effectiveColors[1],
            textColor: effectiveColors[2],
            circleColor: effectiveColors[3],
            borderColor: effectiveBorderColor,
            borderRadius: effectiveBorderRadius,
            useStatusColors:
              config.advancedSettings.useStatusColors ??
              globalAdvancedSettings.useStatusColors,
            showPiePercentages:
              config.advancedSettings.showPiePercentages ??
              globalAdvancedSettings.showPiePercentages,
            showFavorites:
              config.advancedSettings.showFavorites ??
              globalAdvancedSettings.showFavorites,
            gridCols:
              config.advancedSettings.gridCols ??
              globalAdvancedSettings.gridCols,
            gridRows:
              config.advancedSettings.gridRows ??
              globalAdvancedSettings.gridRows,
          },
          {
            userId,
            includeColors: true,
            defaultToCustomPreset: false,
            allowPresetColorOverrides: false,
          },
        );

        const url = buildCardUrlWithParams(urlParams);
        return { cardId, config, url };
      })
      .filter(
        (
          item,
        ): item is { cardId: string; config: CardEditorConfig; url: string } =>
          item !== null,
      );
  }, [
    userId,
    selectedCardIds,
    cardConfigs,
    globalColorPreset,
    getEffectiveColors,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
    globalAdvancedSettings,
  ]);

  const handleCopyUrls = useCallback(
    async (format: "url" | "anilist" = "url") => {
      if (selectedCards.length === 0) return;

      const urls = selectedCards.map((card) => {
        const resolvedUrl = new URL(
          card.url,
          globalThis.location.origin,
        ).toString();
        return format === "anilist" ? `img200(${resolvedUrl})` : resolvedUrl;
      });

      try {
        await navigator.clipboard.writeText(urls.join("\n"));
        setCopiedFormat(format);
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
          copyTimerRef.current = null;
        }
        copyTimerRef.current = globalThis.setTimeout(() => {
          setCopiedFormat(null);
          copyTimerRef.current = null;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
      }
    },
    [selectedCards],
  );
  const handleDownloadAll = useCallback(
    async (format: ConversionFormat = "png") => {
      if (selectedCards.length === 0 || isDownloading) return;

      setIsDownloading(true);
      setDownloadProgress({ current: 0, total: selectedCards.length });

      try {
        // Transform selectedCards to BatchExportCard format for zip export
        const batchCards: BatchExportCard[] = selectedCards.map((card) => ({
          type: card.cardId,
          rawType: `${card.cardId}-${card.config.variant}`,
          svgUrl: card.url,
        }));

        // Clear any prior results or timers
        if (downloadSummaryTimerRef.current) {
          clearTimeout(downloadSummaryTimerRef.current);
          downloadSummaryTimerRef.current = null;
        }
        setDownloadSummary(null);
        setDownloadError(null);

        const result = await batchConvertAndZip(
          batchCards,
          format,
          (progress) => {
            setDownloadProgress({
              current: progress.current,
              total: progress.total,
            });
          },
        );

        // Surface partial failures to the user with details (if available)
        if (result.failed > 0) {
          const failedRawTypes =
            result.failedCards?.map((c) => c.rawType || c.type) ?? [];
          setDownloadSummary({
            total: result.total,
            exported: result.exported,
            failed: result.failed,
            failedCardRawTypes: failedRawTypes,
          });

          // Keep partial-failure visible until user dismisses it
          console.warn(
            `Batch download completed with ${result.failed} failed card(s) out of ${result.total}`,
            failedRawTypes,
          );
        } else {
          // Successful export; show a brief success notice
          setDownloadSummary({
            total: result.total,
            exported: result.exported,
            failed: 0,
          });

          // Auto-dismiss success notice after a short delay
          downloadSummaryTimerRef.current = globalThis.setTimeout(() => {
            setDownloadSummary(null);
            downloadSummaryTimerRef.current = null;
          }, 3000);
        }
      } catch (err) {
        console.error("Failed to download cards as zip:", err);
        const message = err instanceof Error ? err.message : String(err);
        setDownloadError(`Failed to download cards: ${message}`);
      } finally {
        setIsDownloading(false);
        setDownloadProgress({ current: 0, total: 0 });
      }
    },
    [selectedCards, isDownloading],
  );

  // Don't render portal during SSR or before hydration
  if (!isMounted) return null;

  const toolbarContent = (
    <div
      data-testid="bulk-actions-toolbar-host"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{
        paddingLeft: `calc(${sidebarOffset} + ${toolbarGutter})`,
        paddingRight: toolbarGutter,
        bottom: toolbarBottom,
      }}
    >
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            key="toolbar"
            data-testid="bulk-actions-toolbar"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "pointer-events-auto",
              "w-fit max-w-full",
              "flex flex-wrap items-center justify-center gap-2 rounded-2xl sm:gap-3",
              "border border-slate-200/80 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-xl",
              "dark:border-slate-700/80 dark:bg-slate-800/95",
              className,
            )}
          >
            {/* Selection count */}
            <div className="flex items-center gap-2 sm:border-r sm:border-slate-200 sm:pr-3 dark:sm:border-slate-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedCount} selected
                </span>
                <button
                  type="button"
                  onClick={selectAllEnabled}
                  className="text-left text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Select all enabled
                </button>
              </div>
            </div>

            {/* Copy actions */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
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
                    onClick={() => void handleCopyUrls("url")}
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
                    onClick={() => void handleCopyUrls("anilist")}
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

            {/* Download actions */}
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
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
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
                    <span className="ml-auto text-xs text-slate-500">
                      Lossless
                    </span>
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
                    <span className="ml-auto text-xs text-slate-500">
                      Smaller
                    </span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Download status / alerts */}
            <AnimatePresence>
              {downloadError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, height: 0 }}
                  animate={{ opacity: 1, scale: 1, height: "auto" }}
                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full sm:w-auto"
                >
                  <Alert
                    variant="destructive"
                    aria-live="assertive"
                    className="border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle className="text-red-800 dark:text-red-200">
                      Download Error
                    </AlertTitle>
                    <AlertDescription className="text-red-700 dark:text-red-300">
                      {downloadError}
                    </AlertDescription>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDownloadError(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </Alert>
                </motion.div>
              )}

              {downloadSummary && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, height: 0 }}
                  animate={{ opacity: 1, scale: 1, height: "auto" }}
                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full sm:w-auto"
                >
                  <Alert
                    variant={
                      downloadSummary.failed > 0 ? "destructive" : "default"
                    }
                    aria-live={
                      downloadSummary.failed > 0 ? "assertive" : "polite"
                    }
                    className={cn(
                      downloadSummary.failed > 0
                        ? "border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
                        : "border-slate-200/50 bg-white/80 dark:border-slate-700/50 dark:bg-slate-800/80",
                      "mt-2 sm:mt-0",
                    )}
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle
                      className={
                        downloadSummary.failed > 0
                          ? "text-red-800 dark:text-red-200"
                          : "text-slate-900 dark:text-white"
                      }
                    >
                      {downloadSummary.failed > 0
                        ? `Export completed with ${downloadSummary.failed} failed`
                        : `Exported ${downloadSummary.exported}/${downloadSummary.total}`}
                    </AlertTitle>

                    {downloadSummary.failedCardRawTypes &&
                      downloadSummary.failedCardRawTypes.length > 0 && (
                        <AlertDescription
                          className={
                            downloadSummary.failed > 0
                              ? "text-red-700 dark:text-red-300"
                              : "text-slate-600 dark:text-slate-400"
                          }
                        >
                          {downloadSummary.failedCardRawTypes
                            .slice(0, 5)
                            .join(", ")}
                          {downloadSummary.failedCardRawTypes.length > 5
                            ? ", ..."
                            : ""}
                        </AlertDescription>
                      )}

                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDownloadSummary(null)}
                      >
                        Close
                      </Button>

                      {downloadSummary.failed > 0 &&
                        downloadSummary.failedCardRawTypes &&
                        downloadSummary.failedCardRawTypes.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Copy failed card list"
                            onClick={() => {
                              const list =
                                downloadSummary.failedCardRawTypes ?? [];
                              void navigator.clipboard
                                .writeText(list.join("\n"))
                                .catch((err) => {
                                  const msg =
                                    err instanceof Error
                                      ? err.message
                                      : String(err);
                                  setDownloadError(
                                    `Failed to copy failed list: ${msg}`,
                                  );
                                });
                            }}
                          >
                            Copy list
                          </Button>
                        )}
                    </div>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clear selection button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-9 w-9 rounded-lg p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Render toolbar at document body level to avoid overflow-hidden container issues
  return createPortal(toolbarContent, document.body);
}
