"use client";

// Owns the interactive surface for one card: preview lifecycle, compare/expand
// affordances, and per-card actions all live here while the shared editor store
// remains the source of truth for card state.

import { AnimatePresence, motion } from "framer-motion";
import { Columns2, Maximize2 } from "lucide-react";
import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { CardTileDragHandleProps } from "@/components/user/CardCategorySection";
import { CardSettingsDialog } from "@/components/user/CardSettingsDialog";
import { buildPreviewUrl } from "@/components/user/tile/buildPreviewUrl";
import { CardPreview } from "@/components/user/tile/CardPreview";
import { CardTileHeader } from "@/components/user/tile/CardTileHeader";
import { DisabledState } from "@/components/user/tile/DisabledState";
import { VariantSelector } from "@/components/user/tile/VariantSelector";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { useDownload } from "@/hooks/useDownload";
import { getCardInfoTooltip } from "@/lib/card-info-tooltips";
import { getCardVariantTooltip } from "@/lib/card-variant-tooltips";
import {
  type CardEditorConfig,
  isCardCustomized,
  selectIsCardModified,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import { cn, getCardBorderRadius } from "@/lib/utils";

interface CardVariation {
  id: string;
  label: string;
}

interface CardTileProps {
  /** Card type ID */
  cardId: string;
  /** Display label for the card */
  label: string;
  /** Available variations for this card */
  variations: readonly CardVariation[];
  /** Whether this card supports status colors */
  supportsStatusColors?: boolean;
  /** Whether this card supports pie percentages */
  supportsPiePercentages?: boolean;
  /** Whether this card supports favorites */
  supportsFavorites?: boolean;
  /** Whether this card is the favorites grid */
  isFavoritesGrid?: boolean;
  /** Optional info tooltip content (overrides default from card-info-tooltips) */
  infoTooltip?: string;

  /** Optional drag handle wiring (used for drag-and-drop reordering). */
  dragHandleProps?: CardTileDragHandleProps;

  /** Whether the tile is currently being dragged. */
  isDragging?: boolean;
}

const DEFAULT_CARD_CONFIG: CardEditorConfig = {
  cardId: "",
  enabled: false,
  variant: "default",
  colorOverride: { useCustomSettings: false },
  advancedSettings: {},
};

type CardPreviewActionProps = Pick<
  React.ComponentProps<typeof CardPreview>,
  | "isDownloading"
  | "copiedFormat"
  | "copyError"
  | "downloadError"
  | "copyPopoverOpen"
  | "setCopyPopoverOpen"
  | "downloadPopoverOpen"
  | "setDownloadPopoverOpen"
  | "onCopyUrl"
  | "onCopyAniList"
  | "onDownload"
  | "isAnyPopoverOpen"
  | "forceActionsVisible"
>;

type CompareControlsProps = {
  hasVariantOptions: boolean;
  compareEnabled: boolean;
  onToggleCompare: () => void;
  compareVariant: string;
  onCompareVariantChange: (variant: string) => void;
  primaryVariantId: string;
  variations: readonly CardVariation[];
  getVariantTooltipForCard: (variantId: string) => string | null;
  selectTriggerClassName?: string;
  wrapperClassName?: string;
};

function CompareControls({
  hasVariantOptions,
  compareEnabled,
  onToggleCompare,
  compareVariant,
  onCompareVariantChange,
  primaryVariantId,
  variations,
  getVariantTooltipForCard,
  selectTriggerClassName,
  wrapperClassName,
}: Readonly<CompareControlsProps>) {
  const compareSelectTriggerId = useId();

  if (!hasVariantOptions) return null;

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 sm:w-auto",
        wrapperClassName,
      )}
    >
      <Button
        type="button"
        variant={compareEnabled ? "default" : "outline"}
        size="sm"
        aria-pressed={compareEnabled}
        onClick={onToggleCompare}
        className="
          h-8 touch-manipulation-safe border-gold/30 text-gold/80
          hover:border-gold/50 hover:bg-gold/10 hover:text-gold
        "
        title="Compare variants"
      >
        <Columns2 className="size-4" aria-hidden="true" />
        <span className="ml-2 font-display text-xs tracking-wider uppercase">
          Compare
        </span>
      </Button>

      {compareEnabled ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <Label
            htmlFor={compareSelectTriggerId}
            className="font-display text-xs tracking-wider text-gold/50 uppercase"
          >
            With
          </Label>
          <Select value={compareVariant} onValueChange={onCompareVariantChange}>
            <SelectTrigger
              id={compareSelectTriggerId}
              className={cn(
                `
                  h-8 min-w-0 flex-1 touch-manipulation-safe border-gold/25 text-xs
                  hover:border-gold/40
                  sm:w-40 sm:flex-none
                `,
                selectTriggerClassName,
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variations
                .filter((v) => v.id !== primaryVariantId)
                .map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span
                      title={getVariantTooltipForCard(v.id) ?? undefined}
                      className="block"
                    >
                      {v.label}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

type PreviewControlsBarProps = {
  onExpand?: () => void;
  showExpand: boolean;
  showCompare?: boolean;
  compareControls: Omit<CompareControlsProps, "wrapperClassName">;
  compareWrapperClassName?: string;
  className?: string;
};

function PreviewControlsBar({
  onExpand,
  showExpand,
  showCompare = true,
  compareControls,
  compareWrapperClassName,
  className,
}: Readonly<PreviewControlsBarProps>) {
  return (
    <div
      className={cn(
        `
          flex flex-wrap items-center gap-2 border-b-2 border-gold/15 bg-gold/3 px-4 py-2
          backdrop-blur-sm
          dark:border-gold/10 dark:bg-gold/3
        `,
        className,
      )}
    >
      {showExpand ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExpand}
          className="
            h-8 touch-manipulation-safe border-gold/30 text-gold/80
            hover:border-gold/50 hover:bg-gold/10 hover:text-gold
          "
          title="Expand preview"
          data-tour="card-expand"
        >
          <Maximize2 className="size-4" aria-hidden="true" />
          <span className="ml-2 font-display text-xs tracking-wider uppercase">
            Expand
          </span>
        </Button>
      ) : null}

      {showCompare ? (
        <CompareControls
          {...compareControls}
          wrapperClassName={compareWrapperClassName ?? "ml-auto"}
        />
      ) : null}
    </div>
  );
}

type ExpandedPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  hasVariantOptions: boolean;
  primaryVariantLabel: string;
  compareVariant: string;
  compareVariantLabel?: string;
  compareControls: Omit<CompareControlsProps, "wrapperClassName">;
  compareEnabled: boolean;
  previewUrl: string | null;
  comparePreviewUrl: string | null;
  primaryActions: CardPreviewActionProps;
  compareActions: CardPreviewActionProps;
  previewUnavailableId: string;
  convertingId: string;
  borderRadiusValue?: string | number;
  variations: readonly CardVariation[];
  currentVariant: string;
  onVariantChange: (variant: string) => void;
  getVariantTooltipForCard: (variantId: string) => string | null;
};

function ExpandedPreviewDialog({
  open,
  onOpenChange,
  label,
  hasVariantOptions,
  primaryVariantLabel,
  compareVariant,
  compareVariantLabel,
  compareControls,
  compareEnabled,
  previewUrl,
  comparePreviewUrl,
  primaryActions,
  compareActions,
  previewUnavailableId,
  convertingId,
  borderRadiusValue,
  variations,
  currentVariant,
  onVariantChange,
  getVariantTooltipForCard,
}: Readonly<ExpandedPreviewDialogProps>) {
  const isComparing = compareEnabled && Boolean(comparePreviewUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-384 rounded-none border-2 border-gold/20 p-0">
        <AnimatePresence>
          {open && (
            <motion.div
              className="group/card-tile imperial-card overflow-hidden rounded-none border-0 p-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <DialogHeader className="border-b-0 bg-background/90 px-6 pt-5 pb-4 backdrop-blur-sm">
                <DialogTitle className="
                  font-display text-sm tracking-[0.2em] text-foreground uppercase
                ">
                  {label}
                </DialogTitle>
                {hasVariantOptions ? (
                  <DialogDescription className="mt-1 text-xs text-gold/50">
                    Variant: {primaryVariantLabel}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Card preview
                  </DialogDescription>
                )}
                <div className="
                  mt-3 h-px w-full bg-linear-to-r from-transparent via-gold/40 to-transparent
                " />
              </DialogHeader>

              <PreviewControlsBar
                showExpand={false}
                compareControls={{
                  ...compareControls,
                  selectTriggerClassName: "w-[200px]",
                }}
                className="border-b-0 bg-gold/2 px-6 py-3 dark:bg-gold/2"
              />

              <div
                className="relative p-4 sm:p-6"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0l10 10-10 10L0 10z' fill='none' stroke='%23c9a84c' stroke-opacity='0.04' stroke-width='0.5'/%3E%3C/svg%3E\")",
                  backgroundSize: "20px 20px",
                }}
              >
                <div className="border border-gold/10 p-3 sm:p-5">
                  <div
                    className={cn(
                      isComparing
                        ? "grid grid-cols-1 gap-0 sm:grid-cols-[1fr_auto_1fr]"
                        : "",
                    )}
                  >
                    <div>
                      {isComparing ? (
                        <p className="
                          mb-2 text-center font-display text-[10px] tracking-[0.15em] text-gold/40
                          uppercase
                        ">
                          {primaryVariantLabel}
                        </p>
                      ) : null}
                      <CardPreview
                        previewUrl={previewUrl}
                        label={
                          isComparing
                            ? `${label} (${primaryVariantLabel})`
                            : label
                        }
                        previewUnavailableId={previewUnavailableId}
                        convertingId={convertingId}
                        borderRadiusValue={borderRadiusValue}
                        {...primaryActions}
                      />
                    </div>

                    {isComparing ? (
                      <div className="mx-3 hidden items-stretch sm:flex">
                        <div className="
                          w-px self-stretch bg-linear-to-b from-transparent via-gold/30
                          to-transparent
                        " />
                      </div>
                    ) : null}

                    {isComparing ? (
                      <div>
                        <p className="
                          mb-2 text-center font-display text-[10px] tracking-[0.15em] text-gold/40
                          uppercase
                        ">
                          {compareVariantLabel ?? compareVariant}
                        </p>
                        <CardPreview
                          previewUrl={comparePreviewUrl}
                          label={`${label} (${compareVariantLabel ?? compareVariant})`}
                          previewUnavailableId={`${previewUnavailableId}-compare`}
                          convertingId={`${convertingId}-compare`}
                          borderRadiusValue={borderRadiusValue}
                          {...compareActions}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="
                h-px w-full bg-linear-to-r from-transparent via-gold/25 to-transparent
              " />

              <VariantSelector
                variations={variations}
                currentVariant={currentVariant}
                onVariantChange={onVariantChange}
                getVariantTooltip={getVariantTooltipForCard}
                label="Variant (applies to this card)"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export const CardTile = memo(function CardTile({
  cardId,
  label,
  variations,
  supportsStatusColors = false,
  supportsPiePercentages = false,
  supportsFavorites = false,
  isFavoritesGrid = false,
  infoTooltip,
  dragHandleProps,
  isDragging = false,
}: Readonly<CardTileProps>) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewExpandedOpen, setPreviewExpandedOpen] = useState(false);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [downloadPopoverOpen, setDownloadPopoverOpen] = useState(false);
  const [compareCopyPopoverOpen, setCompareCopyPopoverOpen] = useState(false);
  const [compareDownloadPopoverOpen, setCompareDownloadPopoverOpen] =
    useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [compareVariant, setCompareVariant] = useState<string>(() => {
    const fallback = variations[0]?.id ?? "default";
    const alt = variations.find((v) => v.id !== "default")?.id;
    return alt ?? fallback;
  });

  const isAnyPopoverOpen = copyPopoverOpen || downloadPopoverOpen;
  const isAnyComparePopoverOpen =
    compareCopyPopoverOpen || compareDownloadPopoverOpen;
  const forcePreviewActionsVisible = isAnyPopoverOpen;
  const forceComparePreviewActionsVisible = isAnyComparePopoverOpen;

  const tooltipContent = useMemo(
    () => infoTooltip ?? getCardInfoTooltip(cardId),
    [infoTooltip, cardId],
  );

  const {
    userId,
    globalColorPreset,
    globalColors,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    globalAdvancedSettings,
    configFromStore,
    isSelected,
    isModified,
    setCardEnabled,
    setCardVariant,
    toggleCardSelection,
    selectCard,
    deselectCard,
  } = useUserPageEditor(
    useShallow((s) => ({
      userId: s.userId,
      globalColorPreset: s.globalColorPreset,
      globalColors: s.globalColors,
      globalBorderEnabled: s.globalBorderEnabled,
      globalBorderColor: s.globalBorderColor,
      globalBorderRadius: s.globalBorderRadius,
      globalAdvancedSettings: s.globalAdvancedSettings,
      configFromStore: s.cardConfigs[cardId],
      isSelected: s.selectedCardIds.has(cardId),
      isModified: selectIsCardModified(s, cardId),
      setCardEnabled: s.setCardEnabled,
      setCardVariant: s.setCardVariant,
      toggleCardSelection: s.toggleCardSelection,
      selectCard: s.selectCard,
      deselectCard: s.deselectCard,
    })),
  );

  const config = useMemo(
    () => configFromStore ?? { ...DEFAULT_CARD_CONFIG, cardId },
    [configFromStore, cardId],
  );

  const hasVariantOptions = variations.length > 1;

  useEffect(() => {
    if (!hasVariantOptions) {
      setCompareEnabled(false);
      return;
    }

    // If compare variant is invalid or equals the primary variant, pick a sensible fallback.
    const isValid = variations.some((v) => v.id === compareVariant);
    const isSameAsPrimary = compareVariant === config.variant;
    if (isValid && !isSameAsPrimary) return;

    const candidate =
      variations.find((v) => v.id !== config.variant)?.id ?? variations[0].id;
    setCompareVariant(candidate);
  }, [compareVariant, config.variant, hasVariantOptions, variations]);

  const isCustomized = useMemo(() => isCardCustomized(config), [config]);

  const handleToggleSelection = useCallback(
    (checked: boolean | "indeterminate") => {
      if (checked === "indeterminate") {
        // Indeterminate: fall back to toggling selection
        toggleCardSelection(cardId);
      } else if (checked) {
        selectCard(cardId);
      } else {
        deselectCard(cardId);
      }
    },
    [cardId, toggleCardSelection, selectCard, deselectCard],
  );
  const effectiveColors = useMemo(() => {
    if (config.colorOverride.useCustomSettings) {
      return config.colorOverride.colors ?? globalColors;
    }
    return globalColors;
  }, [
    config.colorOverride.colors,
    config.colorOverride.useCustomSettings,
    globalColors,
  ]);

  const effectiveBorderColor = useMemo(() => {
    if (config.borderColor !== undefined) return config.borderColor;
    return globalBorderEnabled ? globalBorderColor : undefined;
  }, [config.borderColor, globalBorderColor, globalBorderEnabled]);

  const effectiveBorderRadius = useMemo(
    () => config.borderRadius ?? globalBorderRadius,
    [config.borderRadius, globalBorderRadius],
  );

  const effectiveColorPreset = useMemo(
    () =>
      config.colorOverride.useCustomSettings
        ? config.colorOverride.colorPreset || "custom"
        : globalColorPreset,
    [
      config.colorOverride.useCustomSettings,
      config.colorOverride.colorPreset,
      globalColorPreset,
    ],
  );

  const urlColorPreset = useMemo(
    () =>
      effectiveColorPreset === "custom" ? undefined : effectiveColorPreset,
    [effectiveColorPreset],
  );

  const previewUrl = useMemo(
    () =>
      buildPreviewUrl({
        userId,
        cardId,
        config,
        urlColorPreset,
        effectiveColors,
        effectiveBorderColor,
        effectiveBorderRadius,
        globalAdvancedSettings,
      }),
    [
      userId,
      cardId,
      config,
      urlColorPreset,
      effectiveColors,
      effectiveBorderColor,
      effectiveBorderRadius,
      globalAdvancedSettings,
    ],
  );

  const comparePreviewUrl = useMemo(() => {
    if (!compareEnabled) return null;
    if (!hasVariantOptions) return null;
    if (compareVariant === config.variant) return null;

    return buildPreviewUrl({
      userId,
      cardId,
      config: { ...config, variant: compareVariant },
      urlColorPreset,
      effectiveColors,
      effectiveBorderColor,
      effectiveBorderRadius,
      globalAdvancedSettings,
    });
  }, [
    compareEnabled,
    hasVariantOptions,
    compareVariant,
    config,
    userId,
    cardId,
    urlColorPreset,
    effectiveColors,
    effectiveBorderColor,
    effectiveBorderRadius,
    globalAdvancedSettings,
  ]);

  const handleToggleEnabled = useCallback(
    (checked: boolean) => {
      setCardEnabled(cardId, checked);
    },
    [cardId, setCardEnabled],
  );

  const handleVariantChange = useCallback(
    (variant: string) => {
      setCardVariant(cardId, variant);
    },
    [cardId, setCardVariant],
  );

  const primaryVariantLabel = useMemo(() => {
    return (
      variations.find((v) => v.id === config.variant)?.label ?? config.variant
    );
  }, [config.variant, variations]);

  const compareVariantLabel = useMemo(() => {
    return variations.find((v) => v.id === compareVariant)?.label;
  }, [compareVariant, variations]);

  const getVariantTooltipForCard = useCallback(
    (variantId: string) => getCardVariantTooltip(cardId, variantId),
    [cardId],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const {
    copiedFormat,
    handleCopy,
    error: copyError,
  } = useCopyFeedback(previewUrl);

  const handleCopyUrl = useCallback(() => handleCopy("url"), [handleCopy]);
  const handleCopyAniList = useCallback(
    () => handleCopy("anilist"),
    [handleCopy],
  );

  const {
    isDownloading,
    error: downloadError,
    handleDownload,
    status: downloadStatus,
  } = useDownload(previewUrl, {
    cardId,
    variant: config.variant,
  });

  const {
    copiedFormat: compareCopiedFormat,
    handleCopy: handleCompareCopy,
    error: compareCopyError,
  } = useCopyFeedback(comparePreviewUrl);

  const handleCompareCopyUrl = useCallback(
    () => handleCompareCopy("url"),
    [handleCompareCopy],
  );
  const handleCompareCopyAniList = useCallback(
    () => handleCompareCopy("anilist"),
    [handleCompareCopy],
  );

  const {
    isDownloading: isCompareDownloading,
    error: compareDownloadError,
    handleDownload: handleCompareDownload,
    status: compareDownloadStatus,
  } = useDownload(comparePreviewUrl, {
    cardId,
    variant: compareVariant,
  });
  const borderRadiusValue = useMemo(
    () => getCardBorderRadius(effectiveBorderRadius),
    [effectiveBorderRadius],
  );

  const previewUnavailableId = `card-${cardId}-preview-unavailable`;
  const convertingId = `card-${cardId}-converting`;

  useEffect(() => {
    if (!previewUrl) {
      setCopyPopoverOpen(false);
      setDownloadPopoverOpen(false);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!comparePreviewUrl) {
      setCompareCopyPopoverOpen(false);
      setCompareDownloadPopoverOpen(false);
    }
  }, [comparePreviewUrl]);

  useEffect(() => {
    if (downloadStatus === "success") {
      setDownloadPopoverOpen(false);
    }
  }, [downloadStatus]);

  useEffect(() => {
    if (compareDownloadStatus === "success") {
      setCompareDownloadPopoverOpen(false);
    }
  }, [compareDownloadStatus]);

  const downloadErrorMessage = downloadError
    ? "Couldn't prepare this card for download."
    : null;
  const compareDownloadErrorMessage = compareDownloadError
    ? "Couldn't prepare this card for download."
    : null;

  const compareControlsProps: Omit<CompareControlsProps, "wrapperClassName"> =
    useMemo<Omit<CompareControlsProps, "wrapperClassName">>(
      () => ({
        hasVariantOptions,
        compareEnabled,
        onToggleCompare: () => setCompareEnabled((v) => !v),
        compareVariant,
        onCompareVariantChange: setCompareVariant,
        primaryVariantId: config.variant,
        variations,
        getVariantTooltipForCard,
      }),
      [
        hasVariantOptions,
        compareEnabled,
        compareVariant,
        config.variant,
        variations,
        getVariantTooltipForCard,
      ],
    );

  return (
    <div
      data-testid={`card-tile-${cardId}`}
      data-tour="card-tile"
      className={cn(
        "group/card-tile relative overflow-hidden border-2 transition-all duration-300",
        `
          focus-within:ring-2 focus-within:ring-gold/70 focus-within:ring-offset-2
          dark:focus-within:ring-offset-background
        `,
        isDragging && "z-10 cursor-grabbing opacity-80",
        config.enabled
          ? `
            border-gold/15 bg-linear-to-br from-gold/5 via-background to-gold/3 shadow-md
            backdrop-blur-sm
            hover:border-gold/30 hover:shadow-[0_0_20px_hsl(var(--gold)/0.08)]
            dark:border-gold/10
            dark:hover:border-gold/25
          `
          : `
            border-gold/15 bg-linear-to-br from-gold/3 via-background to-gold/2 backdrop-blur-sm
            dark:border-gold/10
          `,
        isSelected &&
          config.enabled &&
          "ring-2 ring-gold ring-offset-2 dark:ring-offset-background",
        (isPreviewHovered || isAnyPopoverOpen) &&
          "-translate-y-0.5 shadow-xl shadow-gold/10",
      )}
    >
      <div className="
        pointer-events-none absolute top-0 left-0 size-3 border-t-2 border-l-2 border-gold/60
      " />
      <div className="
        pointer-events-none absolute right-0 bottom-0 size-3 border-r-2 border-b-2 border-gold/60
      " />

      <CardTileHeader
        label={label}
        enabled={config.enabled}
        isCustomized={isCustomized}
        isModified={isModified}
        onToggleEnabled={handleToggleEnabled}
        tooltipContent={tooltipContent}
        isSelected={isSelected}
        onToggleSelection={handleToggleSelection}
        onOpenSettings={openSettings}
        dragHandleProps={dragHandleProps}
      />

      {config.enabled ? (
        <>
          <PreviewControlsBar
            showExpand
            onExpand={() => setPreviewExpandedOpen(true)}
            showCompare={false}
            compareControls={compareControlsProps}
            compareWrapperClassName="ml-auto"
          />

          {/* Compare is only available in the expanded dialog; unexpanded tiles render a single preview. */}
          <CardPreview
            previewUrl={previewUrl}
            label={label}
            previewUnavailableId={previewUnavailableId}
            convertingId={convertingId}
            isDownloading={isDownloading}
            copiedFormat={copiedFormat}
            copyError={copyError}
            downloadError={downloadErrorMessage}
            copyPopoverOpen={copyPopoverOpen}
            setCopyPopoverOpen={setCopyPopoverOpen}
            downloadPopoverOpen={downloadPopoverOpen}
            setDownloadPopoverOpen={setDownloadPopoverOpen}
            onCopyUrl={handleCopyUrl}
            onCopyAniList={handleCopyAniList}
            onDownload={handleDownload}
            isAnyPopoverOpen={isAnyPopoverOpen}
            forceActionsVisible={forcePreviewActionsVisible}
            onHoverChange={setIsPreviewHovered}
            borderRadiusValue={borderRadiusValue}
          />

          <VariantSelector
            variations={variations}
            currentVariant={config.variant}
            onVariantChange={handleVariantChange}
            getVariantTooltip={getVariantTooltipForCard}
          />

          <CardSettingsDialog
            isOpen={settingsOpen}
            onClose={closeSettings}
            cardId={cardId}
            label={label}
            supportsStatusColors={supportsStatusColors}
            supportsPiePercentages={supportsPiePercentages}
            supportsFavorites={supportsFavorites}
            isFavoritesGrid={isFavoritesGrid}
            currentVariant={config.variant}
          />

          <ExpandedPreviewDialog
            open={previewExpandedOpen}
            onOpenChange={setPreviewExpandedOpen}
            label={label}
            hasVariantOptions={hasVariantOptions}
            primaryVariantLabel={primaryVariantLabel}
            compareVariant={compareVariant}
            compareVariantLabel={compareVariantLabel}
            compareControls={compareControlsProps}
            compareEnabled={compareEnabled}
            previewUrl={previewUrl}
            comparePreviewUrl={comparePreviewUrl}
            primaryActions={{
              isDownloading,
              copiedFormat,
              copyError,
              downloadError: downloadErrorMessage,
              copyPopoverOpen,
              setCopyPopoverOpen,
              downloadPopoverOpen,
              setDownloadPopoverOpen,
              onCopyUrl: handleCopyUrl,
              onCopyAniList: handleCopyAniList,
              onDownload: handleDownload,
              isAnyPopoverOpen,
              forceActionsVisible: forcePreviewActionsVisible,
            }}
            compareActions={{
              isDownloading: isCompareDownloading,
              copiedFormat: compareCopiedFormat,
              copyError: compareCopyError,
              downloadError: compareDownloadErrorMessage,
              copyPopoverOpen: compareCopyPopoverOpen,
              setCopyPopoverOpen: setCompareCopyPopoverOpen,
              downloadPopoverOpen: compareDownloadPopoverOpen,
              setDownloadPopoverOpen: setCompareDownloadPopoverOpen,
              onCopyUrl: handleCompareCopyUrl,
              onCopyAniList: handleCompareCopyAniList,
              onDownload: handleCompareDownload,
              isAnyPopoverOpen: isAnyComparePopoverOpen,
              forceActionsVisible: forceComparePreviewActionsVisible,
            }}
            previewUnavailableId={`${previewUnavailableId}-expanded`}
            convertingId={`${convertingId}-expanded`}
            borderRadiusValue={borderRadiusValue}
            variations={variations}
            currentVariant={config.variant}
            onVariantChange={handleVariantChange}
            getVariantTooltipForCard={getVariantTooltipForCard}
          />
        </>
      ) : null}

      {!config.enabled && <DisabledState />}
    </div>
  );
});

CardTile.displayName = "CardTile";
