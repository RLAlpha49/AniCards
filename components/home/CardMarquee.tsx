"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { EASE_OUT_EXPO, VIEWPORT_ONCE } from "@/lib/animations";
import {
  buildCardUrlWithParams,
  CARD_GROUPS,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import {
  CARD_DIMENSIONS,
  type CardDimensions,
  getCardDimensions,
} from "@/lib/svg-templates/common/dimensions";
import { buildApiUrl } from "@/lib/utils";

const BASE_URL = buildApiUrl("/card.svg");
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
const MARQUEE_DIMENSION_OVERRIDES: Partial<
  Record<string, Partial<Record<string, CardDimensions>>>
> = {
  animeCountry: {
    donut: { w: 280, h: 195 },
  },
  animeFormatDistribution: {
    default: { w: 280, h: 230 },
    pie: { w: 340, h: 230 },
    donut: { w: 340, h: 230 },
    bar: { w: 360, h: 236 },
  },
  animeGenres: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  animeGenreSynergy: {
    default: { w: 280, h: 330 },
  },
  animeScoreDistribution: {
    default: { w: 350, h: 271 },
    cumulative: { w: 350, h: 271 },
  },
  animeSeasonalPreference: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  animeSourceMaterialDistribution: {
    default: { w: 280, h: 255 },
    pie: { w: 340, h: 255 },
    donut: { w: 340, h: 255 },
    bar: { w: 360, h: 262 },
  },
  animeStaff: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeStatusDistribution: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeStudios: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeTags: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  animeVoiceActors: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeYearDistribution: {
    default: { w: 350, h: 523 },
    horizontal: { w: 458, h: 150 },
  },
  countryDiversity: {
    default: { w: 450, h: 230 },
  },
  currentlyWatchingReading: {
    default: { w: 420, h: 352 },
    manga: { w: 420, h: 352 },
  },
  droppedMedia: {
    default: { w: 450, h: 244 },
  },
  formatPreferenceOverview: {
    default: { w: 450, h: 262 },
  },
  genreDiversity: {
    default: { w: 450, h: 320 },
  },
  lengthPreference: {
    default: { w: 450, h: 280 },
  },
  mangaCountry: {
    donut: { w: 280, h: 195 },
  },
  mangaGenres: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  mangaScoreDistribution: {
    default: { w: 350, h: 271 },
    cumulative: { w: 350, h: 271 },
  },
  mangaStaff: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  mangaStatusDistribution: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  mangaTags: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  mangaYearDistribution: {
    default: { w: 350, h: 433 },
    horizontal: { w: 458, h: 150 },
  },
  milestones: {
    default: { w: 350, h: 274 },
  },
  mostRewatched: {
    anime: { w: 330, h: 220 },
    manga: { w: 330, h: 220 },
  },
  personalRecords: {
    default: { w: 280, h: 280 },
  },
  releaseEraPreference: {
    default: { w: 450, h: 230 },
  },
  scoreCompareAnimeManga: {
    default: { w: 450, h: 298 },
  },
  startYearMomentum: {
    default: { w: 450, h: 302 },
  },
  studioCollaboration: {
    default: { w: 280, h: 330 },
  },
  tagCategoryDistribution: {
    default: { w: 450, h: 298 },
  },
  tagDiversity: {
    default: { w: 450, h: 244 },
  },
};
const MEDIA_STATS_CARD_TYPES = new Set(["animeStats", "mangaStats"]);
const DISTRIBUTION_CARD_TYPES = new Set([
  "animeScoreDistribution",
  "mangaScoreDistribution",
  "animeYearDistribution",
  "mangaYearDistribution",
]);
const EXTRA_STATS_CARD_TYPES = new Set([
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "animeStatusDistribution",
  "animeFormatDistribution",
  "animeCountry",
  "animeSourceMaterialDistribution",
  "animeSeasonalPreference",
  "animeEpisodeLengthPreferences",
  "animeGenreSynergy",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "mangaStatusDistribution",
  "mangaFormatDistribution",
  "mangaCountry",
  "studioCollaboration",
]);

type MarqueeCard = {
  key: string;
  cardType: string;
  variation: string;
  src: string;
  width: number;
  height: number;
};

type NormalizedVariation = {
  variation: string;
  extras?: Record<string, string>;
};

function buildSrc(
  cardType: string,
  variation: string,
  colorPreset: string,
  extras?: Record<string, string>,
) {
  return buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(
      {
        cardName: cardType,
        variation,
        colorPreset,
        useStatusColors: extras?.statusColors === "true" ? true : undefined,
      },
      { userId: DEFAULT_EXAMPLE_USER_ID, includeColors: false },
    ),
    BASE_URL,
  );
}

function getMarqueeCardDimensions(cardType: string, variation: string) {
  const override = MARQUEE_DIMENSION_OVERRIDES[cardType]?.[variation];
  if (override) {
    return override;
  }

  if (cardType in CARD_DIMENSIONS) {
    return getCardDimensions(
      cardType as keyof typeof CARD_DIMENSIONS,
      variation,
    );
  }

  if (MEDIA_STATS_CARD_TYPES.has(cardType)) {
    return getCardDimensions("mediaStats", variation);
  }

  if (DISTRIBUTION_CARD_TYPES.has(cardType)) {
    return getCardDimensions("distribution", variation);
  }

  if (EXTRA_STATS_CARD_TYPES.has(cardType)) {
    return getCardDimensions("extraStats", variation);
  }

  return { w: 400, h: 200 };
}

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

  const dimensions = getMarqueeCardDimensions(
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
      extras: normalizedVariation.extras,
      width: dimensions.w,
      height: dimensions.h,
    },
  ];
});

function buildMarqueeCards(colorPreset: string): MarqueeCard[] {
  return MARQUEE_CARDS_LAYOUT.map((card) => ({
    key: card.key,
    cardType: card.cardType,
    variation: card.variation,
    src: buildSrc(card.cardType, card.variation, colorPreset, card.extras),
    width: card.width,
    height: card.height,
  }));
}

function getRowDurationMs(cardCount: number, rowIndex: number) {
  return Math.max(MARQUEE_DURATION_MS, cardCount * 3_000 + rowIndex * 4_000);
}

function MarqueeGroup({
  cards,
}: Readonly<{
  cards: readonly MarqueeCard[];
}>) {
  return (
    <div className="marquee-group">
      {cards.map((card) => {
        return (
          <div
            key={card.key}
            className="inline-flex size-auto shrink-0 items-center justify-center"
          >
            <a href={card.src} target="_blank" rel="noopener noreferrer">
              <ImageWithSkeleton
                src={card.src}
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
            </a>
          </div>
        );
      })}
    </div>
  );
}

function MarqueeRow({
  cards,
  durationMs,
  reverse = false,
}: Readonly<{
  cards: readonly MarqueeCard[];
  durationMs: number;
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
        <MarqueeGroup cards={orderedCards} />
        <MarqueeGroup cards={orderedCards} />
      </div>
    </div>
  );
}

export function CardMarquee() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const colorPreset =
    mounted && resolvedTheme === "dark"
      ? "anicardsDarkGradient"
      : "anicardsLightGradient";

  const marqueeRows = useMemo(() => {
    const cards = buildMarqueeCards(colorPreset);
    return buildMarqueeRows(cards, MARQUEE_ROW_COUNT);
  }, [colorPreset]);

  return (
    <motion.section
      className="relative py-16"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
    >
      <div className="gold-line-thick mx-auto mb-10 max-w-[70%]" />

      <div className="space-y-6">
        {marqueeRows.map((row, index) => (
          <MarqueeRow
            key={"marquee-row-" + (row[0]?.key ?? `row-${row.length}`)}
            cards={row}
            durationMs={getRowDurationMs(row.length, index)}
            reverse={index % 2 === 1}
          />
        ))}
      </div>

      <div className="gold-line-thick mx-auto mt-10 max-w-[70%]" />
    </motion.section>
  );
}
