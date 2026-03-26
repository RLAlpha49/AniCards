"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";

import { CardPreviewPlaceholder } from "@/components/CardPreviewPlaceholder";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { EASE_OUT_EXPO, VIEWPORT_ONCE } from "@/lib/animations";
import { CARD_GROUPS } from "@/lib/card-groups";
import {
  buildThemePreviewUrls,
  getPreviewCardDimensions,
} from "@/lib/card-preview";
import { selectThemePreviewUrl } from "@/lib/preview-theme";
const MARQUEE_DURATION_MS = 45_000;
const MARQUEE_ROW_COUNT = 2;
const useIsomorphicLayoutEffect =
  globalThis.window === undefined ? useEffect : useLayoutEffect;
const MARQUEE_VARIATION_PRIORITY = [
  "default",
  "vertical",
  "horizontal",
  "compact",
  "minimal",
  "pie",
  "donut",
  "bar",
  "radar",
  "badges",
  "split",
  "combined",
  "anime",
  "manga",
  "cumulative",
] as const;

type MarqueeCard = {
  key: string;
  cardType: string;
  variation: string;
  previewUrls: {
    light: string;
    dark: string;
  };
  width: number;
  height: number;
};

type NormalizedVariation = {
  variation: string;
  extras?: Record<string, string>;
};

function buildMarqueeRows(cards: readonly MarqueeCard[], rowCount: number) {
  const rows = Array.from({ length: rowCount }, () => [] as MarqueeCard[]);

  cards.forEach((card, index) => {
    rows[index % rowCount].push(card);
  });

  return rows.filter((row) => row.length > 0);
}

function getVariationSignature(extras?: Record<string, string>) {
  if (!extras) return "";

  return Object.entries(extras)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}-${value}`)
    .join("-");
}

function normalizeVariation(
  variationDef: (typeof CARD_GROUPS)[number]["variations"][number],
): NormalizedVariation {
  return typeof variationDef === "string"
    ? { variation: variationDef, extras: undefined }
    : variationDef;
}

function pickMarqueeVariation(
  variations: readonly (typeof CARD_GROUPS)[number]["variations"][number][],
): NormalizedVariation | undefined {
  const normalizedVariations = variations.map(normalizeVariation);

  for (const candidate of MARQUEE_VARIATION_PRIORITY) {
    const match = normalizedVariations.find(
      (variation) => variation.variation === candidate,
    );

    if (match) {
      return match;
    }
  }

  return normalizedVariations[0];
}

const MARQUEE_CARDS_LAYOUT = CARD_GROUPS.flatMap((group) => {
  if (group.cardType === "favoritesGrid") {
    return [];
  }

  const normalizedVariation = pickMarqueeVariation(group.variations);
  if (!normalizedVariation) {
    return [];
  }

  const dimensions = getPreviewCardDimensions(
    group.cardType,
    normalizedVariation.variation,
  );
  const variationSignature = getVariationSignature(normalizedVariation.extras);

  return [
    {
      key: [group.cardType, normalizedVariation.variation, variationSignature]
        .filter(Boolean)
        .join("-"),
      cardType: group.cardType,
      variation: normalizedVariation.variation,
      previewUrls: buildThemePreviewUrls({
        cardType: group.cardType,
        variation: normalizedVariation.variation,
        extras: normalizedVariation.extras,
      }),
      width: dimensions.w,
      height: dimensions.h,
    },
  ];
});
const MARQUEE_ROWS = buildMarqueeRows(MARQUEE_CARDS_LAYOUT, MARQUEE_ROW_COUNT);

function getRowDurationMs(cardCount: number, rowIndex: number) {
  return Math.max(MARQUEE_DURATION_MS, cardCount * 3_000 + rowIndex * 4_000);
}

function MarqueeGroup({
  cards,
  previewColorPreset,
}: Readonly<{
  cards: readonly MarqueeCard[];
  previewColorPreset: ReturnType<typeof usePreviewColorPreset>;
}>) {
  return (
    <div className="marquee-group">
      {cards.map((card) => {
        const previewUrl = selectThemePreviewUrl(
          card.previewUrls,
          previewColorPreset,
        );

        return (
          <div
            key={card.key}
            className="inline-flex size-auto shrink-0 items-center justify-center"
          >
            {previewUrl ? (
              <ImageWithSkeleton
                src={previewUrl}
                alt=""
                className="
                  block size-full rounded-lg! border border-[hsl(var(--gold)/0.12)] object-contain
                  transition-all duration-200
                  hover:scale-[1.03] hover:border-[hsl(var(--gold)/0.35)]
                  hover:shadow-[0_0_12px_hsl(var(--gold)/0.15)]
                "
                width={card.width}
                height={card.height}
                loading="lazy"
                decoding="async"
                fixedDimensions
              />
            ) : (
              <CardPreviewPlaceholder
                className="rounded-lg border border-[hsl(var(--gold)/0.12)]"
                width={card.width}
                height={card.height}
                fixedDimensions
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MarqueeRow({
  cards,
  durationMs,
  previewColorPreset,
  reverse = false,
}: Readonly<{
  cards: readonly MarqueeCard[];
  durationMs: number;
  previewColorPreset: ReturnType<typeof usePreviewColorPreset>;
  reverse?: boolean;
}>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const orderedCards = reverse ? [...cards].reverse() : cards;

  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current;
    const currentWindow = globalThis.window;
    if (!track || !currentWindow) return;

    track.style.animationDelay = `-${currentWindow.performance.now() % durationMs}ms`;
  }, [durationMs]);

  return (
    <div className="marquee-row" aria-hidden="true">
      <div
        ref={trackRef}
        className={`marquee-track ${reverse ? "marquee-reverse" : "marquee-forward"}`}
        style={{ animationDuration: `${durationMs}ms` }}
      >
        <MarqueeGroup
          cards={orderedCards}
          previewColorPreset={previewColorPreset}
        />
        <MarqueeGroup
          cards={orderedCards}
          previewColorPreset={previewColorPreset}
        />
      </div>
    </div>
  );
}

export function CardMarquee() {
  const previewColorPreset = usePreviewColorPreset();

  return (
    <motion.section
      aria-hidden="true"
      className="relative py-16"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
    >
      <div className="gold-line-thick mx-auto mb-10 max-w-[70%]" />

      <div className="space-y-6">
        {MARQUEE_ROWS.map((row, index) => (
          <MarqueeRow
            key={"marquee-row-" + (row[0]?.key ?? `row-${row.length}`)}
            cards={row}
            durationMs={getRowDurationMs(row.length, index)}
            previewColorPreset={previewColorPreset}
            reverse={index % 2 === 1}
          />
        ))}
      </div>

      <div className="gold-line-thick mx-auto mt-10 max-w-[70%]" />
    </motion.section>
  );
}
