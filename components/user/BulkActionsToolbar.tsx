"use client";

// Portal-based toolbar for multi-card actions. It derives everything from the
// current editor snapshot so bulk copy/download/edit stays consistent even when
// the main grid is filtered, reordered, or partially off-screen.

import { AnimatePresence, motion } from "framer-motion";
import { Redo2, RotateCcw, SlidersHorizontal, Undo2, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";

import { colorPresets } from "@/components/stat-card-generator/constants";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { batchConvertAndZip, type BatchExportCard } from "@/lib/batch-export";
import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import { statCardTypes } from "@/lib/card-types";
import {
  type CardEditorConfig,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import { type CardDownloadFormat, cn, toCardApiHref } from "@/lib/utils";

import { BulkConfirmDialog } from "./bulk/BulkConfirmDialog";
import { CopyUrlsPopover } from "./bulk/CopyUrlsPopover";
import { DownloadPopover } from "./bulk/DownloadPopover";
import {
  createDownloadSummary,
  DownloadStatusAlerts,
  type DownloadSummary,
} from "./bulk/DownloadStatusAlerts";
import { SelectionCounter } from "./bulk/SelectionCounter";
import { getCachedPreviewObjectUrl } from "./tile/preview-cache";

interface BulkActionsToolbarProps {
  /** Additional className for the toolbar container */
  className?: string;
}

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

  const [downloadSummary, setDownloadSummary] =
    useState<DownloadSummary | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadSummaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    selectedCount,
    cardConfigs,
    globalColorPreset,
    globalAdvancedSettings,
    bulkPastLength,
    bulkFutureLength,
    bulkLastMessage,
    clearSelection,
    selectAllEnabled,
    selectCardsByGroup,
    getEffectiveColors,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
    bulkSetVariant,
    bulkApplyColorPreset,
    resetSelectedCardsToGlobal,
    undoBulk,
    redoBulk,
  } = useUserPageEditor(
    useShallow((state) => ({
      userId: state.userId,
      selectedCardIds: state.selectedCardIds,
      selectedCount: state.selectedCardIds.size,
      cardConfigs: state.cardConfigs,
      globalColorPreset: state.globalColorPreset,
      globalAdvancedSettings: state.globalAdvancedSettings,
      bulkPastLength: state.bulkPast.length,
      bulkFutureLength: state.bulkFuture.length,
      bulkLastMessage: state.bulkLastMessage,
      clearSelection: state.clearSelection,
      selectAllEnabled: state.selectAllEnabled,
      selectCardsByGroup: state.selectCardsByGroup,
      getEffectiveColors: state.getEffectiveColors,
      getEffectiveBorderColor: state.getEffectiveBorderColor,
      getEffectiveBorderRadius: state.getEffectiveBorderRadius,
      bulkSetVariant: state.bulkSetVariant,
      bulkApplyColorPreset: state.bulkApplyColorPreset,
      resetSelectedCardsToGlobal: state.resetSelectedCardsToGlobal,
      undoBulk: state.undoBulk,
      redoBulk: state.redoBulk,
    })),
  );

  const selectedIds = useMemo(
    () => Array.from(selectedCardIds),
    [selectedCardIds],
  );

  const canUndo = bulkPastLength > 0;
  const canRedo = bulkFutureLength > 0;

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

  const toolbarBottom = "calc(1.5rem + env(safe-area-inset-bottom))";
  const toolbarGutter = "1rem";

  const { selectedCards, skippedDisabledCards } = useMemo(() => {
    if (!userId) {
      return {
        selectedCards: [] as Array<{
          cardId: string;
          cachedSvgObjectUrl: string | null;
          config: CardEditorConfig;
          rawType: string;
          url: string;
        }>,
        skippedDisabledCards: [] as Array<{ cardId: string; rawType: string }>,
      };
    }

    const nextSelectedCards: Array<{
      cardId: string;
      cachedSvgObjectUrl: string | null;
      config: CardEditorConfig;
      rawType: string;
      url: string;
    }> = [];
    const nextSkippedDisabledCards: Array<{ cardId: string; rawType: string }> =
      [];

    for (const cardId of selectedIds) {
      const config = cardConfigs[cardId];
      if (!config) continue;

      const rawType = `${cardId}-${config.variant}`;
      if (!config.enabled) {
        nextSkippedDisabledCards.push({ cardId, rawType });
        continue;
      }

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
            config.advancedSettings.gridCols ?? globalAdvancedSettings.gridCols,
          gridRows:
            config.advancedSettings.gridRows ?? globalAdvancedSettings.gridRows,
        },
        {
          userId,
          includeColors: true,
          defaultToCustomPreset: false,
          allowPresetColorOverrides: false,
        },
      );

      const url = buildCardUrlWithParams(urlParams);
      const previewApiHref = toCardApiHref(url);
      const cachedSvgObjectUrl = previewApiHref
        ? getCachedPreviewObjectUrl(previewApiHref)
        : null;

      nextSelectedCards.push({
        cardId,
        config,
        rawType,
        url,
        cachedSvgObjectUrl,
      });
    }

    return {
      selectedCards: nextSelectedCards,
      skippedDisabledCards: nextSkippedDisabledCards,
    };
  }, [
    userId,
    selectedIds,
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
    async (format: CardDownloadFormat = "png") => {
      if (isDownloading) return;

      const skippedDisabledRawTypes = skippedDisabledCards.map(
        (card) => card.rawType,
      );

      if (selectedCards.length === 0 && skippedDisabledRawTypes.length === 0) {
        return;
      }

      if (downloadSummaryTimerRef.current) {
        clearTimeout(downloadSummaryTimerRef.current);
        downloadSummaryTimerRef.current = null;
      }
      setDownloadSummary(null);
      setDownloadError(null);

      if (selectedCards.length === 0) {
        setDownloadSummary(
          createDownloadSummary({
            requestedTotal: selectedCount,
            skippedDisabledCardRawTypes: skippedDisabledRawTypes,
          }),
        );
        return;
      }

      setIsDownloading(true);
      setDownloadProgress({ current: 0, total: selectedCards.length });

      try {
        const batchCards: BatchExportCard[] = selectedCards.map((card) => ({
          cachedSvgObjectUrl: card.cachedSvgObjectUrl,
          type: card.cardId,
          rawType: card.rawType,
          svgUrl: card.url,
        }));

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

        const failedRawTypes =
          result.failedCards?.map((c) => c.rawType || c.type) ?? [];
        const nextSummary = createDownloadSummary({
          requestedTotal: selectedCount,
          exported: result.exported,
          failed: result.failed,
          failedCardRawTypes: failedRawTypes,
          skippedDisabledCardRawTypes: skippedDisabledRawTypes,
        });

        setDownloadSummary(nextSummary);

        if (nextSummary.failed > 0 || nextSummary.skippedDisabled > 0) {
          console.warn("Batch download completed with issues.", {
            exported: nextSummary.exported,
            failedRawTypes,
            requestedTotal: nextSummary.requestedTotal,
            skippedDisabledRawTypes,
          });
        } else {
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
    [selectedCards, selectedCount, skippedDisabledCards, isDownloading],
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

  if (!isMounted) return null;

  const toolbarContent = (
    <div
      data-testid="bulk-actions-toolbar-host"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{
        paddingLeft: toolbarGutter,
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
              "w-full max-w-full sm:w-fit",
              "flex flex-wrap items-center justify-center gap-2 sm:gap-3",
              `
                border-2 border-gold/25 bg-background/95 px-5 py-3.5 shadow-2xl shadow-gold/10
                backdrop-blur-xl
              `,
              "dark:border-gold/18",
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

            <Popover open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="
                    h-9 gap-1.5 border-gold/20 bg-background px-3 text-foreground
                    hover:bg-gold/5
                    dark:border-gold/15
                  "
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Bulk edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="center" side="top">
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
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
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
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
                      <RotateCcw className="size-4" aria-hidden="true" />
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

            <Button
              variant="ghost"
              size="sm"
              onClick={undoBulk}
              disabled={!canUndo}
              className="
                size-11 p-0 text-muted-foreground
                hover:text-foreground
                disabled:opacity-50
                sm:size-9
              "
              title={canUndo ? "Undo last bulk action" : "Nothing to undo"}
            >
              <Undo2 className="size-4" aria-hidden="true" />
              <span className="sr-only">Undo</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redoBulk}
              disabled={!canRedo}
              className="
                size-11 p-0 text-muted-foreground
                hover:text-foreground
                disabled:opacity-50
                sm:size-9
              "
              title={canRedo ? "Redo last bulk action" : "Nothing to redo"}
            >
              <Redo2 className="size-4" aria-hidden="true" />
              <span className="sr-only">Redo</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="size-11 p-0 text-muted-foreground hover:text-foreground sm:size-9"
              title="Clear selection (Esc)"
              aria-keyshortcuts="Escape"
            >
              <X className="size-4" />
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

  return createPortal(
    <>
      {toolbarContent}
      {confirmDialog}
    </>,
    document.body,
  );
}
