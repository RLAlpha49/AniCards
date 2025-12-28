"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useUserPageEditor,
  type CardEditorConfig,
} from "@/lib/stores/user-page-editor";
import { SelectionCounter } from "./bulk/SelectionCounter";
import { CopyUrlsPopover } from "./bulk/CopyUrlsPopover";
import { DownloadPopover } from "./bulk/DownloadPopover";
import { DownloadStatusAlerts } from "./bulk/DownloadStatusAlerts";
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
      const urls = selectedCards
        .map((card) => {
          try {
            const resolvedUrl = new URL(
              card.url,
              globalThis.location.origin,
            ).toString();
            return format === "anilist"
              ? `img200(${resolvedUrl})`
              : resolvedUrl;
          } catch (err) {
            console.error(
              `Failed to construct URL for card ${card.cardId}:`,
              err,
            );
            return null;
          }
        })
        .filter((url): url is string => url !== null);

      if (urls.length === 0) {
        console.error("No valid URLs to copy");
        return;
      }

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

  const copyFailedListToClipboard = useCallback(
    (list: string[]) => {
      void navigator.clipboard.writeText(list.join("\n")).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setDownloadError(`Failed to copy failed list: ${msg}`);
      });
    },
    [setDownloadError],
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
            <SelectionCounter
              selectedCount={selectedCount}
              selectAllEnabled={selectAllEnabled}
            />

            <CopyUrlsPopover
              copiedFormat={copiedFormat}
              handleCopyUrls={handleCopyUrls}
            />

            <DownloadPopover
              isDownloading={isDownloading}
              downloadProgress={downloadProgress}
              handleDownloadAll={handleDownloadAll}
            />

            <DownloadStatusAlerts
              downloadSummary={downloadSummary}
              downloadError={downloadError}
              setDownloadSummary={setDownloadSummary}
              setDownloadError={setDownloadError}
              copyToClipboard={copyFailedListToClipboard}
            />

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
