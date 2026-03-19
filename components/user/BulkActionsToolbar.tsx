"use client";

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
import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import { statCardTypes } from "@/lib/card-types";
import {
  type CardEditorConfig,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import {
  batchConvertAndZip,
  type BatchExportCard,
  cn,
  type ConversionFormat,
} from "@/lib/utils";

import { BulkConfirmDialog } from "./bulk/BulkConfirmDialog";
import { CopyUrlsPopover } from "./bulk/CopyUrlsPopover";
import { DownloadPopover } from "./bulk/DownloadPopover";
import { DownloadStatusAlerts } from "./bulk/DownloadStatusAlerts";
import { SelectionCounter } from "./bulk/SelectionCounter";

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

  const selectedCount = selectedCardIds.size;

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
        const batchCards: BatchExportCard[] = selectedCards.map((card) => ({
          type: card.cardId,
          rawType: `${card.cardId}-${card.config.variant}`,
          svgUrl: card.url,
        }));

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

        if (result.failed > 0) {
          const failedRawTypes =
            result.failedCards?.map((c) => c.rawType || c.type) ?? [];
          setDownloadSummary({
            total: result.total,
            exported: result.exported,
            failed: result.failed,
            failedCardRawTypes: failedRawTypes,
          });

          console.warn(
            `Batch download completed with ${result.failed} failed card(s) out of ${result.total}`,
            failedRawTypes,
          );
        } else {
          setDownloadSummary({
            total: result.total,
            exported: result.exported,
            failed: 0,
          });

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
              "w-fit max-w-full",
              "flex flex-wrap items-center justify-center gap-2 sm:gap-3",
              "border-gold/25 bg-background/95 shadow-gold/10 border-2 px-5 py-3.5 shadow-2xl backdrop-blur-xl",
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
                  className="border-gold/20 bg-background text-foreground hover:bg-gold/5 dark:border-gold/15 h-9 gap-1.5 rounded-lg px-3"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Bulk edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="center" side="top">
                <div className="space-y-3">
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium">
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
                    <div className="text-muted-foreground mb-1 text-xs font-medium">
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

            <Button
              variant="ghost"
              size="sm"
              onClick={undoBulk}
              disabled={!canUndo}
              className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg p-0 disabled:opacity-50"
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
              className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg p-0 disabled:opacity-50"
              title={canRedo ? "Redo last bulk action" : "Nothing to redo"}
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Redo</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg p-0"
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

  return createPortal(
    <>
      {toolbarContent}
      {confirmDialog}
    </>,
    document.body,
  );
}
