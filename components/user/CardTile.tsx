"use client";

import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { CardTileHeader } from "@/components/user/tile/CardTileHeader";
import { DisabledState } from "@/components/user/tile/DisabledState";
import { VariantSelector } from "@/components/user/tile/VariantSelector";
import { CardPreview } from "@/components/user/tile/CardPreview";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Columns2, Maximize2 } from "lucide-react";

import { CardSettingsDialog } from "@/components/user/CardSettingsDialog";
import type { CardTileDragHandleProps } from "@/components/user/CardCategorySection";
import { getCardInfoTooltip } from "@/lib/card-info-tooltips";
import { getCardVariantTooltip } from "@/lib/card-variant-tooltips";
import {
  type CardEditorConfig,
  isCardCustomized,
  selectIsCardModified,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import { cn, getCardBorderRadius } from "@/lib/utils";
import { buildPreviewUrl } from "@/components/user/tile/buildPreviewUrl";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { useDownload } from "@/hooks/useDownload";
import { useShallow } from "zustand/react/shallow";

/**
 * Variation option for a card type.
 * @source
 */
interface CardVariation {
  id: string;
  label: string;
}

/**
 * Props for CardTile component.
 * @source
 */
interface CardTileProps {
  /** Card type ID */
  cardId: string;
  /** Display label for the card */
  label: string;
  /** Available variations for this card */
  variations: CardVariation[];
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
  variations: CardVariation[];
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
    <div className={cn("flex flex-wrap items-center gap-2", wrapperClassName)}>
      <Button
        type="button"
        variant={compareEnabled ? "default" : "outline"}
        size="sm"
        aria-pressed={compareEnabled}
        onClick={onToggleCompare}
        className="h-8"
        title="Compare variants"
      >
        <Columns2 className="h-4 w-4" aria-hidden="true" />
        <span className="ml-2">Compare</span>
      </Button>

      {compareEnabled ? (
        <div className="flex items-center gap-2">
          <Label
            htmlFor={compareSelectTriggerId}
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            With
          </Label>
          <Select value={compareVariant} onValueChange={onCompareVariantChange}>
            <SelectTrigger
              id={compareSelectTriggerId}
              className={cn("h-8 w-[160px] text-xs", selectTriggerClassName)}
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
        "flex flex-wrap items-center gap-2 border-b border-slate-200/50 bg-white/40 px-4 py-2 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/20",
        className,
      )}
    >
      {showExpand ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExpand}
          className="h-8"
          title="Expand preview"
          data-tour="card-expand"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          <span className="ml-2">Expand</span>
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
  variations: CardVariation[];
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
      <DialogContent className="max-h-[90vh] w-[min(98vw,96rem)] max-w-none overflow-y-auto p-0">
        <div className="group/card-tile overflow-hidden rounded-2xl">
          <DialogHeader className="border-b border-slate-200/60 bg-white/85 px-6 py-4 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/40">
            <DialogTitle className="text-base">{label}</DialogTitle>
            <DialogDescription className="text-xs">
              Preview
              {hasVariantOptions ? ` • Variant: ${primaryVariantLabel}` : ""}
            </DialogDescription>
          </DialogHeader>

          <PreviewControlsBar
            showExpand={false}
            compareControls={{
              ...compareControls,
              selectTriggerClassName: "w-[200px]",
            }}
            className="bg-white/60 px-6 py-3 dark:bg-slate-900/25"
          />

          {/* Add breathing room around previews (especially in compare mode) */}
          <div className="p-4 sm:p-6">
            <div
              className={cn(
                isComparing ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "",
              )}
            >
              <CardPreview
                previewUrl={previewUrl}
                label={
                  isComparing ? `${label} (${primaryVariantLabel})` : label
                }
                previewUnavailableId={previewUnavailableId}
                convertingId={convertingId}
                borderRadiusValue={borderRadiusValue}
                {...primaryActions}
              />

              {isComparing ? (
                <CardPreview
                  previewUrl={comparePreviewUrl}
                  label={`${label} (${compareVariantLabel ?? compareVariant})`}
                  previewUnavailableId={`${previewUnavailableId}-compare`}
                  convertingId={`${convertingId}-compare`}
                  borderRadiusValue={borderRadiusValue}
                  {...compareActions}
                />
              ) : null}
            </div>
          </div>

          <VariantSelector
            variations={variations}
            currentVariant={currentVariant}
            onVariantChange={onVariantChange}
            getVariantTooltip={getVariantTooltipForCard}
            label="Variant (applies to this card)"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Individual card tile with preview, variant selector, and settings.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
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

  // Track if any popover is open to maintain hover state
  const isAnyPopoverOpen = copyPopoverOpen || downloadPopoverOpen;
  const isAnyComparePopoverOpen =
    compareCopyPopoverOpen || compareDownloadPopoverOpen;
  const forcePreviewActionsVisible = isAnyPopoverOpen;
  const forceComparePreviewActionsVisible = isAnyComparePopoverOpen;

  // Get info tooltip content - prop overrides default from card-info-tooltips
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

  // Ensure compare state stays valid as variants change.
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

  // Build preview URL
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

  const { copiedFormat, handleCopy } = useCopyFeedback(previewUrl);

  const handleCopyUrl = useCallback(() => handleCopy("url"), [handleCopy]);
  const handleCopyAniList = useCallback(
    () => handleCopy("anilist"),
    [handleCopy],
  );

  const { isDownloading, handleDownload } = useDownload(previewUrl, {
    cardId,
    variant: config.variant,
  });

  const { copiedFormat: compareCopiedFormat, handleCopy: handleCompareCopy } =
    useCopyFeedback(comparePreviewUrl);

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
    handleDownload: handleCompareDownload,
  } = useDownload(comparePreviewUrl, {
    cardId,
    variant: compareVariant,
  });
  const borderRadiusValue = useMemo(
    () => getCardBorderRadius(effectiveBorderRadius),
    [effectiveBorderRadius],
  );

  // Accessibility helpers: IDs for sr-only descriptions
  const previewUnavailableId = `card-${cardId}-preview-unavailable`;
  const convertingId = `card-${cardId}-converting`;

  // Close popovers if preview becomes unavailable
  useEffect(() => {
    if (!previewUrl) {
      setCopyPopoverOpen(false);
      setDownloadPopoverOpen(false);
    }
  }, [previewUrl]);

  // Close compare popovers if compare preview becomes unavailable
  useEffect(() => {
    if (!comparePreviewUrl) {
      setCompareCopyPopoverOpen(false);
      setCompareDownloadPopoverOpen(false);
    }
  }, [comparePreviewUrl]);

  // Close download popover when conversion starts
  useEffect(() => {
    if (isDownloading) {
      setDownloadPopoverOpen(false);
    }
  }, [isDownloading]);

  useEffect(() => {
    if (isCompareDownloading) {
      setCompareDownloadPopoverOpen(false);
    }
  }, [isCompareDownloading]);

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
        "group/card-tile relative overflow-hidden rounded-2xl border transition-all duration-200",
        "focus-within:ring-2 focus-within:ring-blue-500/70 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-950",
        isDragging && "z-10 cursor-grabbing opacity-80",
        config.enabled
          ? "border-blue-200/70 bg-white/85 shadow-md backdrop-blur-sm dark:border-blue-800/40 dark:bg-slate-900/55"
          : "border-slate-200/60 bg-slate-50/60 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/35",
        isSelected &&
          config.enabled &&
          "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900",
        (isPreviewHovered || isAnyPopoverOpen) && "-translate-y-0.5 shadow-xl",
      )}
    >
      {/* Card Header */}
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

      {/* Disabled State Overlay */}
      {!config.enabled && <DisabledState />}
    </div>
  );
});

CardTile.displayName = "CardTile";
