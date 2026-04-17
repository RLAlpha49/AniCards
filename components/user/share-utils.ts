import { batchConvertAndZip, type BatchExportCard } from "@/lib/batch-export";
import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import type {
  CardAdvancedSettings,
  CardEditorConfig,
} from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import { type CardDownloadFormat, toCardApiHref } from "@/lib/utils";

import { getCachedPreviewObjectUrl } from "./tile/preview-cache";

export type ShareCardUrlFormat = "url" | "anilist";

export type ShareableCardDescriptor = {
  cachedSvgObjectUrl: string | null;
  cardId: string;
  rawType: string;
  url: string;
};

export type BuildShareableCardsArgs = {
  userId: string | null;
  cardIds: readonly string[];
  cardConfigs: Record<string, CardEditorConfig>;
  globalColorPreset: string;
  globalAdvancedSettings: CardAdvancedSettings;
  getEffectiveColors: (cardId: string) => ColorValue[];
  getEffectiveBorderColor: (cardId: string) => string | undefined;
  getEffectiveBorderRadius: (cardId: string) => number;
};

export function buildShareableCards(args: BuildShareableCardsArgs): {
  shareableCards: ShareableCardDescriptor[];
  skippedDisabledCards: Array<{ cardId: string; rawType: string }>;
} {
  if (!args.userId) {
    return {
      shareableCards: [],
      skippedDisabledCards: [],
    };
  }

  const shareableCards: ShareableCardDescriptor[] = [];
  const skippedDisabledCards: Array<{ cardId: string; rawType: string }> = [];

  for (const cardId of args.cardIds) {
    const config = args.cardConfigs[cardId];
    if (!config) continue;

    const rawType = `${cardId}-${config.variant}`;
    if (!config.enabled) {
      skippedDisabledCards.push({ cardId, rawType });
      continue;
    }

    const effectiveColors = args.getEffectiveColors(cardId);
    const effectiveBorderColor = args.getEffectiveBorderColor(cardId);
    const effectiveBorderRadius = args.getEffectiveBorderRadius(cardId);
    const effectiveColorPreset = config.colorOverride.useCustomSettings
      ? config.colorOverride.colorPreset || "custom"
      : args.globalColorPreset;
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
          args.globalAdvancedSettings.useStatusColors,
        showPiePercentages:
          config.advancedSettings.showPiePercentages ??
          args.globalAdvancedSettings.showPiePercentages,
        showFavorites:
          config.advancedSettings.showFavorites ??
          args.globalAdvancedSettings.showFavorites,
        gridCols:
          config.advancedSettings.gridCols ??
          args.globalAdvancedSettings.gridCols,
        gridRows:
          config.advancedSettings.gridRows ??
          args.globalAdvancedSettings.gridRows,
      },
      {
        userId: args.userId,
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

    shareableCards.push({
      cachedSvgObjectUrl,
      cardId,
      rawType,
      url,
    });
  }

  return {
    shareableCards,
    skippedDisabledCards,
  };
}

export async function copyShareableCardUrlsToClipboard(
  cards: readonly Pick<ShareableCardDescriptor, "cardId" | "url">[],
  format: ShareCardUrlFormat = "url",
): Promise<{ copiedCount: number; lines: string[] }> {
  const lines = cards
    .map((card) => {
      try {
        const resolvedUrl = new URL(
          card.url,
          globalThis.location.origin,
        ).toString();
        return format === "anilist" ? `img200(${resolvedUrl})` : resolvedUrl;
      } catch (error) {
        console.error(
          `Failed to construct URL for card ${card.cardId}:`,
          error,
        );
        return null;
      }
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    throw new Error("No valid card URLs available to copy.");
  }

  await navigator.clipboard.writeText(lines.join("\n"));

  return {
    copiedCount: lines.length,
    lines,
  };
}

export async function downloadShareableCards(args: {
  cards: readonly ShareableCardDescriptor[];
  format?: CardDownloadFormat;
  onProgress?: (progress: { current: number; total: number }) => void;
}) {
  const batchCards: BatchExportCard[] = args.cards.map((card) => ({
    cachedSvgObjectUrl: card.cachedSvgObjectUrl,
    rawType: card.rawType,
    svgUrl: card.url,
    type: card.cardId,
  }));

  return await batchConvertAndZip(
    batchCards,
    args.format ?? "png",
    (progress) => {
      args.onProgress?.({
        current: progress.current,
        total: progress.total,
      });
    },
  );
}
