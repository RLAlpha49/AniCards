import type { BatchExportCard, BatchExportSummary } from "@/lib/batch-export";
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

export type ShareCardUrlFormat =
  | "url"
  | "anilist"
  | "markdown"
  | "html"
  | "manifest";

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

type OrderedCardIdsArgs = {
  cardConfigs: Record<string, CardEditorConfig>;
  cardOrder: readonly string[];
  includeCardId?: (cardId: string) => boolean;
};

type CopyShareableCardDescriptor = Pick<
  ShareableCardDescriptor,
  "cardId" | "url"
> &
  Partial<Pick<ShareableCardDescriptor, "rawType">>;

type ResolvedShareableCardUrl = {
  cardId: string;
  rawType?: string;
  resolvedUrl: string;
};

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeMarkdownText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}

function resolveShareableCardUrls(
  cards: readonly CopyShareableCardDescriptor[],
): ResolvedShareableCardUrl[] {
  return cards
    .map((card) => {
      try {
        const resolvedUrl = new URL(
          card.url,
          globalThis.location.origin,
        ).toString();

        const protocol = new URL(resolvedUrl).protocol;
        if (protocol !== "http:" && protocol !== "https:") {
          throw new Error(`Unsupported protocol: ${protocol}`);
        }

        return {
          cardId: card.cardId,
          ...(card.rawType ? { rawType: card.rawType } : {}),
          resolvedUrl,
        };
      } catch (error) {
        console.error(
          `Failed to construct URL for card ${card.cardId}:`,
          error,
        );
        return null;
      }
    })
    .filter((card): card is ResolvedShareableCardUrl => card !== null);
}

function buildShareableCardClipboardLines(
  cards: readonly ResolvedShareableCardUrl[],
  format: ShareCardUrlFormat,
): string[] {
  switch (format) {
    case "url":
      return cards.map((card) => card.resolvedUrl);

    case "anilist":
      return cards.map((card) => `img200(${card.resolvedUrl})`);

    case "markdown":
      return cards.map((card) => {
        const label = escapeMarkdownText(
          `AniCards ${card.rawType ?? card.cardId}`,
        );
        return `[![${label}](${card.resolvedUrl})](${card.resolvedUrl})`;
      });

    case "html": {
      const lines = ['<section class="anicards-showcase">'];

      for (const card of cards) {
        const cardId = escapeHtmlAttribute(card.cardId);
        const rawType = escapeHtmlAttribute(card.rawType ?? card.cardId);
        const url = escapeHtmlAttribute(card.resolvedUrl);
        lines.push(
          `  <a href="${url}" data-card-id="${cardId}" data-card-raw-type="${rawType}">`,
          `    <img src="${url}" alt="AniCards ${rawType}" loading="lazy" />`,
          "  </a>",
        );
      }

      lines.push("</section>");
      return lines;
    }

    case "manifest":
      return JSON.stringify(
        {
          schemaVersion: 1,
          kind: "anicards-showcase",
          cards: cards.map((card, index) => ({
            order: index + 1,
            cardId: card.cardId,
            rawType: card.rawType ?? card.cardId,
            url: card.resolvedUrl,
          })),
        },
        null,
        2,
      ).split("\n");
  }
}

export function getOrderedCardIds(args: OrderedCardIdsArgs): string[] {
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  const shouldIncludeCardId = args.includeCardId ?? (() => true);

  for (const cardId of args.cardOrder) {
    if (!args.cardConfigs[cardId] || seen.has(cardId)) continue;
    if (!shouldIncludeCardId(cardId)) continue;
    seen.add(cardId);
    orderedIds.push(cardId);
  }

  for (const cardId of Object.keys(args.cardConfigs).sort((a, b) =>
    a.localeCompare(b),
  )) {
    if (seen.has(cardId)) continue;
    if (!shouldIncludeCardId(cardId)) continue;
    seen.add(cardId);
    orderedIds.push(cardId);
  }

  return orderedIds;
}

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
  cards: readonly CopyShareableCardDescriptor[],
  format: ShareCardUrlFormat = "url",
): Promise<{ copiedCount: number; lines: string[] }> {
  const resolvedCards = resolveShareableCardUrls(cards);
  const lines = buildShareableCardClipboardLines(resolvedCards, format);

  if (resolvedCards.length === 0 || lines.length === 0) {
    throw new Error("No valid card URLs available to copy.");
  }

  await navigator.clipboard.writeText(lines.join("\n"));

  return {
    copiedCount: resolvedCards.length,
    lines,
  };
}

export async function downloadShareableCards(args: {
  cards: readonly ShareableCardDescriptor[];
  format?: CardDownloadFormat;
  onProgress?: (progress: { current: number; total: number }) => void;
}): Promise<BatchExportSummary> {
  const { batchConvertAndZip } = await import("@/lib/batch-export");

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
