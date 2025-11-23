"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";

const BASE_CARD_URL = "https://anicards.alpha49.com/api/card.svg";
const EXAMPLE_USER_ID = "542244";

const buildCardUrl = (
  cardType: string,
  variation: string,
  extras?: Record<string, string>,
) => {
  const params = new URLSearchParams({
    cardType,
    userId: EXAMPLE_USER_ID,
    variation,
    ...extras,
  });

  return `${BASE_CARD_URL}?${params.toString()}`;
};

type ExampleCardVariant = {
  cardType: string;
  cardTitle: string;
  variation: string;
  label: string;
  extras?: Record<string, string>;
};

const EXAMPLE_CARD_VARIANTS: ExampleCardVariant[] = [
  {
    cardType: "animeStats",
    cardTitle: "Anime Statistics",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeStats",
    cardTitle: "Anime Statistics",
    variation: "vertical",
    label: "Vertical",
  },
  {
    cardType: "animeStats",
    cardTitle: "Anime Statistics",
    variation: "compact",
    label: "Compact",
  },
  {
    cardType: "animeStats",
    cardTitle: "Anime Statistics",
    variation: "minimal",
    label: "Minimal",
  },
  {
    cardType: "mangaStats",
    cardTitle: "Manga Statistics",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaStats",
    cardTitle: "Manga Statistics",
    variation: "vertical",
    label: "Vertical",
  },
  {
    cardType: "mangaStats",
    cardTitle: "Manga Statistics",
    variation: "compact",
    label: "Compact",
  },
  {
    cardType: "mangaStats",
    cardTitle: "Manga Statistics",
    variation: "minimal",
    label: "Minimal",
  },
  {
    cardType: "socialStats",
    cardTitle: "Social Statistics",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "socialStats",
    cardTitle: "Social Statistics",
    variation: "compact",
    label: "Compact",
  },
  {
    cardType: "socialStats",
    cardTitle: "Social Statistics",
    variation: "minimal",
    label: "Minimal",
  },
  {
    cardType: "animeGenres",
    cardTitle: "Anime Genres",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeGenres",
    cardTitle: "Anime Genres",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeGenres",
    cardTitle: "Anime Genres",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeTags",
    cardTitle: "Anime Tags",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeTags",
    cardTitle: "Anime Tags",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeTags",
    cardTitle: "Anime Tags",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeVoiceActors",
    cardTitle: "Voice Actors",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeVoiceActors",
    cardTitle: "Voice Actors",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeVoiceActors",
    cardTitle: "Voice Actors",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeStudios",
    cardTitle: "Animation Studios",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeStudios",
    cardTitle: "Animation Studios",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeStudios",
    cardTitle: "Animation Studios",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeStaff",
    cardTitle: "Anime Staff",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeStaff",
    cardTitle: "Anime Staff",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeStaff",
    cardTitle: "Anime Staff",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeStatusDistribution",
    cardTitle: "Anime Status Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeStatusDistribution",
    cardTitle: "Anime Status Distribution",
    variation: "pie",
    label: "Pie Chart",
    extras: { statusColors: "true" },
  },
  {
    cardType: "animeStatusDistribution",
    cardTitle: "Anime Status Distribution",
    variation: "bar",
    label: "Bar Chart",
    extras: { statusColors: "true" },
  },
  {
    cardType: "animeFormatDistribution",
    cardTitle: "Anime Format Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeFormatDistribution",
    cardTitle: "Anime Format Distribution",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeFormatDistribution",
    cardTitle: "Anime Format Distribution",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeCountry",
    cardTitle: "Anime Country Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeCountry",
    cardTitle: "Anime Country Distribution",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "animeCountry",
    cardTitle: "Anime Country Distribution",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "animeScoreDistribution",
    cardTitle: "Anime Score Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeScoreDistribution",
    cardTitle: "Anime Score Distribution",
    variation: "horizontal",
    label: "Horizontal",
  },
  {
    cardType: "animeYearDistribution",
    cardTitle: "Anime Year Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "animeYearDistribution",
    cardTitle: "Anime Year Distribution",
    variation: "horizontal",
    label: "Horizontal",
  },
  {
    cardType: "mangaGenres",
    cardTitle: "Manga Genres",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaGenres",
    cardTitle: "Manga Genres",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "mangaGenres",
    cardTitle: "Manga Genres",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "mangaTags",
    cardTitle: "Manga Tags",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaTags",
    cardTitle: "Manga Tags",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "mangaTags",
    cardTitle: "Manga Tags",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "mangaStaff",
    cardTitle: "Manga Staff",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaStaff",
    cardTitle: "Manga Staff",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "mangaStaff",
    cardTitle: "Manga Staff",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "mangaStatusDistribution",
    cardTitle: "Manga Status Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaStatusDistribution",
    cardTitle: "Manga Status Distribution",
    variation: "pie",
    label: "Pie Chart",
    extras: { statusColors: "true" },
  },
  {
    cardType: "mangaStatusDistribution",
    cardTitle: "Manga Status Distribution",
    variation: "bar",
    label: "Bar Chart",
    extras: { statusColors: "true" },
  },
  {
    cardType: "mangaFormatDistribution",
    cardTitle: "Manga Format Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaFormatDistribution",
    cardTitle: "Manga Format Distribution",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "mangaFormatDistribution",
    cardTitle: "Manga Format Distribution",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "mangaCountry",
    cardTitle: "Manga Country Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaCountry",
    cardTitle: "Manga Country Distribution",
    variation: "pie",
    label: "Pie Chart",
  },
  {
    cardType: "mangaCountry",
    cardTitle: "Manga Country Distribution",
    variation: "bar",
    label: "Bar Chart",
  },
  {
    cardType: "mangaScoreDistribution",
    cardTitle: "Manga Score Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaScoreDistribution",
    cardTitle: "Manga Score Distribution",
    variation: "horizontal",
    label: "Horizontal",
  },
  {
    cardType: "mangaYearDistribution",
    cardTitle: "Manga Year Distribution",
    variation: "default",
    label: "Default",
  },
  {
    cardType: "mangaYearDistribution",
    cardTitle: "Manga Year Distribution",
    variation: "horizontal",
    label: "Horizontal",
  },
];

type VariantCard = {
  id: string;
  title: string;
  variationLabel: string;
  src: string;
};

const VARIANT_LIBRARY: VariantCard[] = EXAMPLE_CARD_VARIANTS.map((variant) => ({
  id: `${variant.cardType}-${variant.variation}-${variant.label.replaceAll(/\s+/g, "-").toLowerCase()}`,
  title: variant.cardTitle,
  variationLabel: variant.label,
  src: buildCardUrl(variant.cardType, variant.variation, variant.extras),
}));

type LayoutSlot = {
  id: string;
  className: string;
  baseAnimate?: {
    y?: number;
    rotate?: number;
  };
  delay?: number;
  opacity?: number;
};

const LAYOUTS: Record<"hero" | "search", LayoutSlot[]> = {
  hero: [
    {
      id: "hero-slot-0",
      className:
        "absolute top-[15%] left-[5%] w-[280px] lg:w-[380px] -rotate-6 hidden lg:block",
      baseAnimate: { y: 15, rotate: -6 },
      delay: 0,
      opacity: 0.92,
    },
    {
      id: "hero-slot-1",
      className:
        "absolute top-[20%] right-[5%] w-[280px] lg:w-[380px] rotate-6 hidden lg:block",
      baseAnimate: { y: 15, rotate: 6 },
      delay: 0.5,
      opacity: 0.92,
    },
    {
      id: "hero-slot-2",
      className:
        "absolute bottom-[20%] left-[10%] w-[240px] lg:w-[320px] rotate-12 hidden lg:block",
      baseAnimate: { y: 20, rotate: 12 },
      delay: 1,
      opacity: 0.92,
    },
    {
      id: "hero-slot-3",
      className:
        "absolute bottom-[25%] right-[10%] w-[240px] lg:w-[320px] -rotate-12 hidden lg:block",
      baseAnimate: { y: 20, rotate: -12 },
      delay: 1.5,
      opacity: 0.92,
    },
    {
      id: "hero-slot-4",
      className:
        "absolute top-[45%] left-[-2%] w-[200px] lg:w-[260px] -rotate-12 hidden xl:block",
      baseAnimate: { y: 10, rotate: -12 },
      delay: 2,
      opacity: 0.75,
    },
    {
      id: "hero-slot-5",
      className:
        "absolute top-[50%] right-[-2%] w-[200px] lg:w-[260px] rotate-12 hidden xl:block",
      baseAnimate: { y: 10, rotate: 12 },
      delay: 2.5,
      opacity: 0.75,
    },
  ],
  search: [
    {
      id: "search-slot-0",
      className:
        "absolute top-[15%] left-[5%] w-[280px] lg:w-[380px] -rotate-6 hidden xl:block",
      baseAnimate: { y: 15, rotate: -6 },
      delay: 0,
      opacity: 0.9,
    },
    {
      id: "search-slot-1",
      className:
        "absolute top-[20%] right-[5%] w-[280px] lg:w-[380px] rotate-6 hidden xl:block",
      baseAnimate: { y: 15, rotate: 6 },
      delay: 0.5,
      opacity: 0.9,
    },
    {
      id: "search-slot-2",
      className:
        "absolute bottom-[20%] left-[10%] w-[240px] lg:w-[320px] rotate-12 hidden xl:block",
      baseAnimate: { y: 20, rotate: 12 },
      delay: 1,
      opacity: 0.9,
    },
    {
      id: "search-slot-3",
      className:
        "absolute bottom-[25%] right-[10%] w-[240px] lg:w-[320px] -rotate-12 hidden xl:block",
      baseAnimate: { y: 20, rotate: -12 },
      delay: 1.5,
      opacity: 0.9,
    },
  ],
};

type FloatingCardsLayerProps = {
  layout?: keyof typeof LAYOUTS;
  maxCards?: number;
  containerClassName?: string;
};

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const selectRandomVariants = (count: number): VariantCard[] => {
  const pool = [...VARIANT_LIBRARY];
  const limit = Math.min(count, pool.length);
  const selected: VariantCard[] = [];

  for (let i = 0; i < limit; i += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const [variant] = pool.splice(randomIndex, 1);

    if (variant) {
      selected.push(variant);
    }
  }

  return selected;
};

export function FloatingCardsLayer({
  layout = "hero",
  maxCards,
  containerClassName,
}: Readonly<FloatingCardsLayerProps>) {
  const slots = LAYOUTS[layout] ?? LAYOUTS.hero;
  const cardCount = Math.max(
    1,
    Math.min(maxCards ?? slots.length, slots.length),
  );

  const displayCards = useMemo(() => {
    const randomVariants = selectRandomVariants(cardCount);

    return slots.slice(0, cardCount).map((slot, index) => {
      const variant = randomVariants[index];

      return {
        ...slot,
        displaySrc: variant?.src ?? "",
        displayAlt: variant?.title
          ? `${variant.title} • ${variant.variationLabel}`
          : slot.id,
      };
    });
  }, [slots, cardCount]);

  const jitterConfig = useMemo(
    () =>
      displayCards.map(() => ({
        yOffset: randomBetween(6, 12),
        rotateOffset: randomBetween(2, 10),
        yDirection: Math.random() < 0.5 ? -1 : 1,
        rotateDirection: Math.random() < 0.5 ? -1 : 1,
        delayOffset: randomBetween(-0.3, 0.5),
        scaleVariance: randomBetween(0.02, 0.06),
        cycleDuration: randomBetween(6, 9),
        opacity: randomBetween(0.6, 0.9),
      })),
    [displayCards],
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0",
        containerClassName,
      )}
    >
      {displayCards.map((card, index) => {
        const seed = jitterConfig[index];
        const baseY = card.baseAnimate?.y ?? 15;
        const baseRotate = card.baseAnimate?.rotate ?? 0;
        const softenedY = (baseY + seed.yOffset) * 0.65;
        const ySequence = [0, seed.yDirection * softenedY, 0];
        const rotateSequence = [
          baseRotate,
          baseRotate + seed.rotateDirection * seed.rotateOffset,
          baseRotate,
        ];
        const scaleSequence = [
          1 - seed.scaleVariance,
          1 + seed.scaleVariance,
          1,
        ];
        const delay = Math.max(0, (card.delay ?? 0) + seed.delayOffset);
        const layoutOpacity = Math.min(card.opacity ?? 0.9, 0.9);
        const cardOpacity = Math.min(seed.opacity, layoutOpacity);

        return (
          <motion.div
            key={`${card.id}-${index}-${card.displayAlt}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: cardOpacity,
              scale: scaleSequence,
              y: ySequence,
              rotate: rotateSequence,
            }}
            transition={{
              opacity: { duration: 0.8, delay },
              scale: { duration: 0.8, delay },
              default: {
                duration: seed.cycleDuration,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            className={cn(
              card.className,
              "rounded-xl bg-white p-1 shadow-2xl dark:bg-slate-800",
            )}
          >
            <div className="h-full w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
              <ImageWithSkeleton
                src={card.displaySrc}
                alt={card.displayAlt}
                className="h-full w-full object-contain"
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
