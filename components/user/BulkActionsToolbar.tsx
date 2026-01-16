"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Redo2, RotateCcw, SlidersHorizontal, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useUserPageEditor,
  type CardEditorConfig,
} from "@/lib/stores/user-page-editor";
import { SelectionCounter } from "./bulk/SelectionCounter";
import { CopyUrlsPopover } from "./bulk/CopyUrlsPopover";
import { DownloadPopover } from "./bulk/DownloadPopover";
import { DownloadStatusAlerts } from "./bulk/DownloadStatusAlerts";
import { BulkConfirmDialog } from "./bulk/BulkConfirmDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { colorPresets } from "@/components/stat-card-generator/constants";
import { statCardTypes } from "@/lib/card-types";

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
  const [copiedFormat, setCopiedFormat] = useState<
    "url" | "anilist" | "failed-list" | null
  >(null);
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
    selectCardsByGroup,
    getEffectiveColors,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
    globalAdvancedSettings,
    bulkSetVariant,
    bulkApplyColorPreset,
    resetSelectedCardsToGlobal,
    undoBulk,
    redoBulk,
    bulkPast,
    bulkFuture,
    bulkLastMessage,
  } = useUserPageEditor();

  const selectedIds = useMemo(
    () => Array.from(selectedCardIds),
    [selectedCardIds],
  );

  const canUndo = bulkPast.length > 0;
  const canRedo = bulkFuture.length > 0;

  const groupOptions = useMemo(() => {
    const present = new Set(Object.keys(cardConfigs));
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];

    for (const t of statCardTypes) {
      if (!present.has(t.id)) continue;
      if (seen.has(t.group)) continue;
      seen.add(t.group);
      options.push({ value: t.group, label: t.group });
    }

    return options;
  }, [cardConfigs]);

  const presetOptions = useMemo(() => {
    const keys = Object.keys(colorPresets);
    // Prefer "default" first, then alphabetical for stability.
    keys.sort((a, b) => {
      if (a === "default") return -1;
      if (b === "default") return 1;
      return a.localeCompare(b);
    });
    return keys;
  }, []);

  const commonVariantOptions = useMemo(() => {
    if (selectedIds.length === 0) return [];

    const metaById = new Map(statCardTypes.map((t) => [t.id, t] as const));

    const first = metaById.get(selectedIds[0]);
    if (!first) return [];

    let intersection = new Set(first.variations.map((v) => v.id));
    for (const cardId of selectedIds.slice(1)) {
      const meta = metaById.get(cardId);
      if (!meta) return [];
      const allowed = new Set(meta.variations.map((v) => v.id));
      intersection = new Set(
        Array.from(intersection).filter((id) => allowed.has(id)),
      );
      if (intersection.size === 0) return [];
    }

    return first.variations.filter((v) => intersection.has(v.id));
  }, [selectedIds]);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive: boolean;
    affectedCardIds: string[];
    onConfirm: () => void;
  }>(null);

  const buildPreviewItems = useCallback(
    (cardIds: string[]) => {
      const metaById = new Map(statCardTypes.map((t) => [t.id, t] as const));
      return cardIds
        .map((cardId) => {
          const meta = metaById.get(cardId);
          return {
            cardId,
            label: meta?.label ?? cardId,
            group: meta?.group,
            enabled: Boolean(cardConfigs[cardId]?.enabled),
          };
        })
        .sort((a, b) => {
          const ga = a.group ?? "";
          const gb = b.group ?? "";
          if (ga !== gb) return ga.localeCompare(gb);
          return a.label.localeCompare(b.label);
        });
    },
    [cardConfigs],
  );

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

  const handleApplyVariant = useCallback(
    (variantId: string) => {
      if (selectedIds.length === 0) return;
      bulkSetVariant(selectedIds, variantId);
      setBulkEditOpen(false);
    },
    [bulkSetVariant, selectedIds],
  );

  const handleApplyPreset = useCallback(
    (presetName: string) => {
      if (selectedIds.length === 0) return;

      const overwriteIds = selectedIds.filter((cardId) => {
        const cfg = cardConfigs[cardId];
        return Boolean(cfg?.colorOverride.useCustomSettings);
      });

      const doApply = () => {
        bulkApplyColorPreset(selectedIds, presetName);
        setBulkEditOpen(false);
      };

      if (overwriteIds.length > 0) {
        setConfirmState({
          title: `Apply preset "${presetName}" to selected cards?`,
          description: (
            <>
              This will apply the preset to{" "}
              <strong>{selectedIds.length}</strong> cards.
              <br />
              <br />
              <span className="font-medium text-red-600 dark:text-red-400">
                {overwriteIds.length} card(s) already have custom colors and
                will be overwritten.
              </span>
              <br />
              <br />
              You can undo this afterwards.
            </>
          ),
          confirmLabel: "Apply preset",
          destructive: true,
          affectedCardIds: selectedIds,
          onConfirm: doApply,
        });
        return;
      }

      doApply();
    },
    [bulkApplyColorPreset, cardConfigs, selectedIds],
  );

  const handleResetSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setConfirmState({
      title: "Reset selected cards to global settings?",
      description: (
        <>
          This removes custom per-card colors, borders, and advanced settings
          from the selected cards.
          <br />
          <br />
          You can undo this afterwards.
        </>
      ),
      confirmLabel: "Reset selected",
      destructive: true,
      affectedCardIds: selectedIds,
      onConfirm: () => {
        resetSelectedCardsToGlobal(selectedIds);
        setBulkEditOpen(false);
      },
    });
  }, [resetSelectedCardsToGlobal, selectedIds]);

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
    async (list: string[]) => {
      if (list.length === 0) return;

      try {
        await navigator.clipboard.writeText(list.join("\n"));

        setCopiedFormat("failed-list");
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
          copyTimerRef.current = null;
        }
        copyTimerRef.current = globalThis.setTimeout(() => {
          setCopiedFormat(null);
          copyTimerRef.current = null;
        }, 2000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setDownloadError(`Failed to copy failed list: ${msg}`);
      }
    },
    [setDownloadError, setCopiedFormat],
  );

  const confirmPreviewItems = useMemo(() => {
    if (!confirmState) return [];
    return buildPreviewItems(confirmState.affectedCardIds);
  }, [buildPreviewItems, confirmState]);

  const confirmDialog = (
    <BulkConfirmDialog
      open={confirmState !== null}
      onOpenChange={(open) => {
        if (!open) setConfirmState(null);
      }}
      title={confirmState?.title ?? "Confirm"}
      description={confirmState?.description}
      confirmLabel={confirmState?.confirmLabel ?? "Confirm"}
      confirmDestructive={confirmState?.destructive ?? false}
      previewItems={confirmPreviewItems}
      totalAffected={confirmState?.affectedCardIds.length ?? 0}
      onConfirm={() => {
        const action = confirmState?.onConfirm;
        setConfirmState(null);
        action?.();
      }}
    />
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
              onSelectAllEnabled={selectAllEnabled}
              groupOptions={groupOptions}
              onSelectGroup={selectCardsByGroup}
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

            {/* Bulk edit popover: variant + preset + reset selected */}
            <Popover open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Bulk edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="center" side="top">
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      Variant
                    </div>
                    <Select
                      disabled={commonVariantOptions.length === 0}
                      onValueChange={handleApplyVariant}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue
                          placeholder={
                            commonVariantOptions.length === 0
                              ? "No common variants"
                              : "Select variant"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {commonVariantOptions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      Color preset
                    </div>
                    <Select onValueChange={handleApplyPreset}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {presetOptions.map((preset) => (
                          <SelectItem key={preset} value={preset}>
                            {preset}
                            {preset === globalColorPreset ? " (global)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 flex-1"
                      onClick={handleResetSelected}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Reset selected
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <DownloadStatusAlerts
              downloadSummary={downloadSummary}
              downloadError={downloadError}
              setDownloadSummary={setDownloadSummary}
              setDownloadError={setDownloadError}
              copyToClipboard={copyFailedListToClipboard}
            />

            {/* Bulk undo/redo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={undoBulk}
              disabled={!canUndo}
              className="h-9 w-9 rounded-lg p-0 text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
              title={canUndo ? "Undo last bulk action" : "Nothing to undo"}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Undo</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redoBulk}
              disabled={!canRedo}
              className="h-9 w-9 rounded-lg p-0 text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
              title={canRedo ? "Redo last bulk action" : "Nothing to redo"}
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Redo</span>
            </Button>

            {/* Clear selection button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-9 w-9 rounded-lg p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              title="Clear selection (Esc)"
              aria-keyshortcuts="Escape"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear selection</span>
            </Button>

            {bulkLastMessage ? (
              <span className="sr-only" aria-live="polite" aria-atomic="true">
                {bulkLastMessage}
              </span>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Render toolbar at document body level to avoid overflow-hidden container issues
  return createPortal(
    <>
      {toolbarContent}
      {confirmDialog}
    </>,
    document.body,
  );
}
