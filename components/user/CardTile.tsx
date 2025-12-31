"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { CardTileHeader } from "@/components/user/tile/CardTileHeader";
import { DisabledState } from "@/components/user/tile/DisabledState";
import { VariantSelector } from "@/components/user/tile/VariantSelector";
import { CardPreview } from "@/components/user/tile/CardPreview";

import { CardSettingsDialog } from "@/components/user/CardSettingsDialog";
import { getCardInfoTooltip } from "@/lib/card-info-tooltips";
import {
  CardEditorConfig,
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
}

const DEFAULT_CARD_CONFIG: CardEditorConfig = {
  cardId: "",
  enabled: false,
  variant: "default",
  colorOverride: { useCustomSettings: false },
  advancedSettings: {},
};

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
}: Readonly<CardTileProps>) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [downloadPopoverOpen, setDownloadPopoverOpen] = useState(false);

  // Track if any popover is open to maintain hover state
  const isAnyPopoverOpen = copyPopoverOpen || downloadPopoverOpen;

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

  const effectiveColorPreset = config.colorOverride.useCustomSettings
    ? config.colorOverride.colorPreset || "custom"
    : globalColorPreset;

  const urlColorPreset =
    effectiveColorPreset === "custom" ? undefined : effectiveColorPreset;

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

  // Close download popover when conversion starts
  useEffect(() => {
    if (isDownloading) {
      setDownloadPopoverOpen(false);
    }
  }, [isDownloading]);

  return (
    <div
      data-testid={`card-tile-${cardId}`}
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all duration-200",
        config.enabled
          ? "border-blue-200 bg-white shadow-md dark:border-blue-800/50 dark:bg-slate-800"
          : "border-slate-200/50 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/50",
        isSelected &&
          config.enabled &&
          "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900",
      )}
    >
      {/* Card Header */}
      <CardTileHeader
        label={label}
        enabled={config.enabled}
        onToggleEnabled={handleToggleEnabled}
        tooltipContent={tooltipContent}
        isSelected={isSelected}
        onToggleSelection={handleToggleSelection}
        onOpenSettings={openSettings}
      />

      {/* Preview and Controls (only when enabled) */}
      {config.enabled && (
        <>
          {/* Preview Image */}
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
            borderRadiusValue={borderRadiusValue}
          />

          {/* Variant Selector */}
          <VariantSelector
            variations={variations}
            currentVariant={config.variant}
            onVariantChange={handleVariantChange}
          />

          {/* Settings Dialog */}
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
        </>
      )}

      {/* Disabled State Overlay */}
      {!config.enabled && <DisabledState />}
    </div>
  );
});

CardTile.displayName = "CardTile";
