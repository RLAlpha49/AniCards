"use client";

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
        className="border-gold/30 text-gold/80 hover:border-gold/50 hover:bg-gold/10 hover:text-gold h-8"
        title="Compare variants"
      >
        <Columns2 className="h-4 w-4" aria-hidden="true" />
        <span className="font-display ml-2 text-xs tracking-wider uppercase">
          Compare
        </span>
      </Button>

      {compareEnabled ? (
        <div className="flex items-center gap-2">
          <Label
            htmlFor={compareSelectTriggerId}
            className="font-display text-gold/50 text-xs tracking-wider uppercase"
          >
            With
          </Label>
          <Select value={compareVariant} onValueChange={onCompareVariantChange}>
            <SelectTrigger
              id={compareSelectTriggerId}
              className={cn(
                "border-gold/25 hover:border-gold/40 h-8 w-40 text-xs",
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
        "border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 flex flex-wrap items-center gap-2 border-b-2 px-4 py-2 backdrop-blur-sm",
        className,
      )}
    >
      {showExpand ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExpand}
          className="border-gold/30 text-gold/80 hover:border-gold/50 hover:bg-gold/10 hover:text-gold h-8"
          title="Expand preview"
          data-tour="card-expand"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          <span className="font-display ml-2 text-xs tracking-wider uppercase">
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
      <DialogContent className="border-gold/20 max-h-[90vh] w-[min(98vw,96rem)] max-w-none overflow-y-auto rounded-none border-2 p-0">
        <AnimatePresence>
          {open && (
            <motion.div
              className="imperial-card group/card-tile overflow-hidden rounded-none border-0 p-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <DialogHeader className="bg-background/90 border-b-0 px-6 pt-5 pb-4 backdrop-blur-sm">
                <DialogTitle className="font-display text-foreground text-sm tracking-[0.2em] uppercase">
                  {label}
                </DialogTitle>
                {hasVariantOptions ? (
                  <DialogDescription className="text-gold/50 mt-1 text-xs">
                    Variant: {primaryVariantLabel}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Card preview
                  </DialogDescription>
                )}
                <div className="via-gold/40 mt-3 h-px w-full bg-linear-to-r from-transparent to-transparent" />
              </DialogHeader>

              <PreviewControlsBar
                showExpand={false}
                compareControls={{
                  ...compareControls,
                  selectTriggerClassName: "w-[200px]",
                }}
                className="bg-gold/2 dark:bg-gold/2 border-b-0 px-6 py-3"
              />

              <div
                className="relative p-4 sm:p-6"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0l10 10-10 10L0 10z' fill='none' stroke='%23c9a84c' stroke-opacity='0.04' stroke-width='0.5'/%3E%3C/svg%3E\")",
                  backgroundSize: "20px 20px",
                }}
              >
                <div className="border-gold/10 rounded-sm border p-3 sm:p-5">
                  <div
                    className={cn(
                      isComparing
                        ? "grid grid-cols-1 gap-0 sm:grid-cols-[1fr_auto_1fr]"
                        : "",
                    )}
                  >
                    <div>
                      {isComparing ? (
                        <p className="font-display text-gold/40 mb-2 text-center text-[10px] tracking-[0.15em] uppercase">
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
                        <div className="via-gold/30 w-px self-stretch bg-linear-to-b from-transparent to-transparent" />
                      </div>
                    ) : null}

                    {isComparing ? (
                      <div>
                        <p className="font-display text-gold/40 mb-2 text-center text-[10px] tracking-[0.15em] uppercase">
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

              <div className="via-gold/25 h-px w-full bg-linear-to-r from-transparent to-transparent" />

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
        "group/card-tile relative overflow-hidden border-2 transition-all duration-300",
        "focus-within:ring-gold/70 dark:focus-within:ring-offset-background focus-within:ring-2 focus-within:ring-offset-2",
        isDragging && "z-10 cursor-grabbing opacity-80",
        config.enabled
          ? "border-gold/15 from-gold/5 via-background to-gold/3 hover:border-gold/30 dark:border-gold/10 dark:hover:border-gold/25 bg-linear-to-br shadow-md backdrop-blur-sm hover:shadow-[0_0_20px_hsl(var(--gold)/0.08)]"
          : "border-gold/15 from-gold/3 via-background to-gold/2 dark:border-gold/10 bg-linear-to-br backdrop-blur-sm",
        isSelected &&
          config.enabled &&
          "ring-gold dark:ring-offset-background ring-2 ring-offset-2",
        (isPreviewHovered || isAnyPopoverOpen) &&
          "shadow-gold/10 -translate-y-0.5 shadow-xl",
      )}
    >
      <div className="border-gold/60 pointer-events-none absolute top-0 left-0 h-3 w-3 border-t-2 border-l-2" />
      <div className="border-gold/60 pointer-events-none absolute right-0 bottom-0 h-3 w-3 border-r-2 border-b-2" />

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

      {!config.enabled && <DisabledState />}
    </div>
  );
});

CardTile.displayName = "CardTile";
