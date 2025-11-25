"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import {
  VARIATION_LABEL_MAP,
  buildCardUrl,
  generateExampleCardVariants,
} from "@/lib/card-groups";

/**
 * Example card variants generated for demo/preview displays.
 * These are derived from the project's example generator utilities.
 * @source
 */
const EXAMPLE_CARD_VARIANTS = generateExampleCardVariants(VARIATION_LABEL_MAP);

/**
 * Representation of a card variant used in the floating card layer.
 * id - unique identifier for the variant.
 * title - human-friendly title for alt text and diagnostics.
 * variationLabel - label indicating variation specifics.
 * src - absolute URL for the generated card image.
 * @source
 */
type VariantCard = {
  id: string;
  title: string;
  variationLabel: string;
  src: string;
};

/**
 * In-memory library of variant cards used to pick random previews.
 * Built from example variants and their generated image URLs.
 * @source
 */
const VARIANT_LIBRARY: VariantCard[] = EXAMPLE_CARD_VARIANTS.map((variant) => ({
  id: `${variant.cardType}-${variant.variation}-${variant.label.replaceAll(/\s+/g, "-").toLowerCase()}`,
  title: variant.cardTitle,
  variationLabel: variant.label,
  src: buildCardUrl(variant.cardType, variant.variation, variant.extras),
}));

/**
 * Layout metadata for a visual slot where a card preview can be rendered.
 * baseAnimate contains optional transform offsets used by Framer Motion.
 * @source
 */
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

/**
 * Preset layouts describing where to position floating cards for different UI contexts.
 * @source
 */
const LAYOUTS: Record<"hero" | "search", LayoutSlot[]> = {
  hero: [
    {
      id: "hero-slot-0",
      className: "absolute top-[15%] left-[5%] -rotate-6 hidden xs:block",
      baseAnimate: { y: 15, rotate: -6 },
      delay: 0,
      opacity: 0.92,
    },
    {
      id: "hero-slot-1",
      className: "absolute top-[20%] right-[5%] rotate-6 hidden md:block",
      baseAnimate: { y: 15, rotate: 6 },
      delay: 0.5,
      opacity: 0.92,
    },
    {
      id: "hero-slot-2",
      className: "absolute bottom-[20%] left-[10%] rotate-12 hidden xs:block",
      baseAnimate: { y: 20, rotate: 12 },
      delay: 1,
      opacity: 0.92,
    },
    {
      id: "hero-slot-3",
      className: "absolute bottom-[25%] right-[10%] -rotate-12 hidden md:block",
      baseAnimate: { y: 20, rotate: -12 },
      delay: 1.5,
      opacity: 0.92,
    },
    {
      id: "hero-slot-4",
      className: "absolute top-[45%] left-[-2%] -rotate-12 hidden lg:block",
      baseAnimate: { y: 10, rotate: -12 },
      delay: 2,
      opacity: 0.75,
    },
    {
      id: "hero-slot-5",
      className: "absolute top-[50%] right-[-2%] rotate-12 hidden lg:block",
      baseAnimate: { y: 10, rotate: 12 },
      delay: 2.5,
      opacity: 0.75,
    },
  ],
  search: [
    {
      id: "search-slot-0",
      className: "absolute top-[15%] left-[5%] -rotate-6 hidden xl:block",
      baseAnimate: { y: 15, rotate: -6 },
      delay: 0,
      opacity: 0.9,
    },
    {
      id: "search-slot-1",
      className: "absolute top-[20%] right-[5%] rotate-6 hidden xl:block",
      baseAnimate: { y: 15, rotate: 6 },
      delay: 0.5,
      opacity: 0.9,
    },
    {
      id: "search-slot-2",
      className: "absolute bottom-[20%] left-[10%] rotate-12 hidden xl:block",
      baseAnimate: { y: 20, rotate: 12 },
      delay: 1,
      opacity: 0.9,
    },
    {
      id: "search-slot-3",
      className: "absolute bottom-[25%] right-[10%] -rotate-12 hidden xl:block",
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

/**
 * Returns a random decimal value between min (inclusive) and max (exclusive).
 * Used to produce jitter and variety in floating card motion.
 * @source
 */
const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

/**
 * Select a set of unique random variant cards from the global VARIANT_LIBRARY.
 * Ensures there are no duplicate selections by splicing from a local pool.
 * @source
 */
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

/**
 * Decorative floating card layer that uses Framer Motion for subtle animation.
 * layout - selects one of the predefined layouts for card placement.
 * maxCards - limits the number of cards to display (clamped by slot count).
 * containerClassName - additional container classes to be merged in.
 * @source
 */
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
