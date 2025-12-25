"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  Settings,
  Copy,
  Check,
  Download,
  ChevronDown,
  Loader2,
  Info,
  Link,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { CardSettingsDialog } from "@/components/user/CardSettingsDialog";
import {
  MathTooltipContent,
  containsMath,
} from "@/components/MathTooltipContent";
import { getCardInfoTooltip } from "@/lib/card-info-tooltips";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import {
  cn,
  getCardBorderRadius,
  svgToPng,
  getAbsoluteUrl,
  type ConversionFormat,
} from "@/lib/utils";
import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";

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

/**
 * Individual card tile with preview, variant selector, and settings.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
export function CardTile({
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
  const [copiedFormat, setCopiedFormat] = useState<"url" | "anilist" | null>(
    null,
  );
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [downloadPopoverOpen, setDownloadPopoverOpen] = useState(false);

  // Track if any popover is open to maintain hover state
  const isAnyPopoverOpen = copyPopoverOpen || downloadPopoverOpen;

  // Get info tooltip content - prop overrides default from card-info-tooltips
  const tooltipContent = infoTooltip ?? getCardInfoTooltip(cardId);

  const {
    userId,
    cardConfigs,
    globalColorPreset,
    selectedCardIds,
    setCardEnabled,
    setCardVariant,
    toggleCardSelection,
    getEffectiveColors,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
  } = useUserPageEditor();

  const isSelected = selectedCardIds.has(cardId);

  // Get or create card config
  const config = cardConfigs[cardId] || {
    cardId,
    enabled: false,
    variant: "default",
    colorOverride: { useCustomSettings: false },
    advancedSettings: {},
  };

  const effectiveColors = getEffectiveColors(cardId);
  const effectiveBorderColor = getEffectiveBorderColor(cardId);
  const effectiveBorderRadius = getEffectiveBorderRadius(cardId);

  const effectiveColorPreset = config.colorOverride.useCustomSettings
    ? config.colorOverride.colorPreset || "custom"
    : globalColorPreset;

  const urlColorPreset =
    effectiveColorPreset === "custom" ? undefined : effectiveColorPreset;

  // Build preview URL
  const previewUrl = useMemo(() => {
    if (!userId) return null;

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
        useStatusColors: config.advancedSettings.useStatusColors,
        showPiePercentages: config.advancedSettings.showPiePercentages,
        showFavorites: config.advancedSettings.showFavorites,
        gridCols: config.advancedSettings.gridCols,
        gridRows: config.advancedSettings.gridRows,
      },
      {
        userId,
        includeColors: true,
        defaultToCustomPreset: false,
        allowPresetColorOverrides: false,
      },
    );

    return buildCardUrlWithParams(urlParams);
  }, [
    userId,
    cardId,
    config,
    urlColorPreset,
    effectiveColors,
    effectiveBorderColor,
    effectiveBorderRadius,
  ]);

  const handleToggleEnabled = useCallback(() => {
    setCardEnabled(cardId, !config.enabled);
  }, [cardId, config.enabled, setCardEnabled]);

  const handleToggleSelection = useCallback(() => {
    toggleCardSelection(cardId);
  }, [cardId, toggleCardSelection]);

  const handleVariantChange = useCallback(
    (variant: string) => {
      setCardVariant(cardId, variant);
    },
    [cardId, setCardVariant],
  );

  const handleCopyUrl = useCallback(
    async (format: "url" | "anilist" = "url") => {
      if (!previewUrl) return;
      const resolvedUrl = new URL(
        previewUrl,
        globalThis.location.origin,
      ).toString();
      const textToCopy =
        format === "anilist" ? `img200(${resolvedUrl})` : resolvedUrl;
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedFormat(format);
        setTimeout(() => setCopiedFormat(null), 2000);
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
      }
    },
    [previewUrl],
  );

  const [isDownloading, setIsDownloading] = useState(false);

  /**
   * Convert the card to the requested format and trigger a download.
   * Uses the /api/convert endpoint for PNG/WebP conversion.
   */
  const handleDownload = useCallback(
    async (format: ConversionFormat = "png") => {
      if (!previewUrl || isDownloading) return;
      setIsDownloading(true);
      try {
        const absoluteUrl = getAbsoluteUrl(previewUrl);
        const dataUrl = await svgToPng(absoluteUrl, format);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${cardId}-${config.variant}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error("Failed to download card:", error);
      } finally {
        setIsDownloading(false);
      }
    },
    [previewUrl, cardId, config.variant, isDownloading],
  );

  const borderRadiusValue = getCardBorderRadius(effectiveBorderRadius);

  return (
    <div
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
      <div className="flex items-center justify-between border-b border-slate-200/50 px-4 py-3 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <Switch
            checked={config.enabled}
            onCheckedChange={handleToggleEnabled}
            className="data-[state=checked]:bg-blue-500"
            aria-label={`Toggle ${label} card`}
          />
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <h4
              className={cn(
                "truncate text-sm font-medium transition-colors",
                config.enabled
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              {label}
            </h4>
            {tooltipContent && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex-shrink-0 rounded-full p-0.5 transition-colors",
                        "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                      )}
                      aria-label={`Info about ${label}`}
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-xs text-xs leading-relaxed"
                    sideOffset={8}
                  >
                    {containsMath(tooltipContent) ? (
                      <MathTooltipContent content={tooltipContent} />
                    ) : (
                      <p>{tooltipContent}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config.enabled && (
            <>
              {/* Selection checkbox */}
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleToggleSelection}
                className={cn(
                  "h-5 w-5 rounded-md border-2 transition-all",
                  "data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500",
                  "hover:border-blue-400",
                  !isSelected &&
                    "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800",
                )}
                aria-label={`Select ${label} card`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 p-0 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"
                title="Card settings"
                aria-label={`Open settings for ${label}`}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview and Controls (only when enabled) */}
      {config.enabled && (
        <>
          {/* Preview Image */}
          <div className="relative aspect-[2/1] overflow-hidden bg-slate-100 dark:bg-slate-900">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={`${label} preview`}
                fill
                unoptimized
                className="object-contain p-2"
                style={{ borderRadius: borderRadiusValue }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <Eye className="h-8 w-8" />
              </div>
            )}

            {/* Quick Actions Overlay */}
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center gap-2 transition-all",
                isAnyPopoverOpen
                  ? "bg-black/40 opacity-100"
                  : "bg-black/0 opacity-0 group-hover:bg-black/40 group-hover:opacity-100",
              )}
            >
              <Popover open={copyPopoverOpen} onOpenChange={setCopyPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 rounded-full px-3 text-sm font-medium shadow-lg transition-all",
                      copiedFormat
                        ? "bg-green-500 text-white shadow-green-500/25 hover:bg-green-600"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-purple-500/25 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30",
                      isAnyPopoverOpen && "opacity-100",
                    )}
                  >
                    {copiedFormat ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        <span>Copy URL</span>
                        <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1.5" align="center">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => void handleCopyUrl("url")}
                    >
                      <Link
                        className="h-4 w-4 text-blue-600 dark:text-blue-400"
                        aria-hidden="true"
                      />
                      <span>Copy URL</span>
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
                      onClick={() => void handleCopyUrl("anilist")}
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
              <Popover
                open={downloadPopoverOpen}
                onOpenChange={setDownloadPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDownloading}
                    className={cn(
                      "h-8 gap-1.5 rounded-full px-3 text-sm font-medium shadow-lg transition-all",
                      "border-2 border-white/80 bg-white/20 text-white backdrop-blur-sm",
                      "hover:border-white hover:bg-white/30",
                      "disabled:opacity-70",
                      isAnyPopoverOpen && "opacity-100",
                    )}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        <span>Converting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span>Download</span>
                        <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1.5" align="center">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 justify-start gap-2 rounded-md px-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => void handleDownload("png")}
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
                      onClick={() => void handleDownload("webp")}
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
            </div>
          </div>

          {/* Variant Selector */}
          {variations.length > 1 && (
            <div className="border-t border-slate-200/50 px-4 py-3 dark:border-slate-700/50">
              <Label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Variant
              </Label>
              <Select
                value={config.variant}
                onValueChange={handleVariantChange}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Select variant" />
                </SelectTrigger>
                <SelectContent>
                  {variations.map((variation) => (
                    <SelectItem key={variation.id} value={variation.id}>
                      {variation.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Settings Dialog */}
          <CardSettingsDialog
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
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
      {!config.enabled && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <EyeOff className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Card disabled
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
