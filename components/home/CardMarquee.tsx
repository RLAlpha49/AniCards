"use client";

import { motion } from "framer-motion";

import { CardPreviewPlaceholder } from "@/components/CardPreviewPlaceholder";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { buildFadeUpVariants, VIEWPORT_ONCE } from "@/lib/animations";
import { selectThemePreviewUrl } from "@/lib/preview-theme";

const MARQUEE_DURATION_MS = 45_000;

type MarqueeCard = {
  height: number;
  key: string;
  previewUrls: {
    dark: string;
    light: string;
  };
  width: number;
};

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
                "
                width={card.width}
                height={card.height}
                loading="lazy"
                decoding="async"
                fixedDimensions
                mode="lightweight"
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
  rowIndex,
  reverse = false,
  simplified = false,
}: Readonly<{
  cards: readonly MarqueeCard[];
  durationMs: number;
  previewColorPreset: ReturnType<typeof usePreviewColorPreset>;
  rowIndex: number;
  reverse?: boolean;
  simplified?: boolean;
}>) {
  const orderedCards = reverse ? [...cards].reverse() : cards;

  if (simplified) {
    return (
      <div className="overflow-x-auto py-3" aria-hidden="true">
        <MarqueeGroup
          cards={orderedCards}
          previewColorPreset={previewColorPreset}
        />
      </div>
    );
  }

  return (
    <div className="marquee-row" aria-hidden="true">
      <div
        className={`marquee-track ${reverse ? "marquee-reverse" : "marquee-forward"}`}
        style={{
          animationDuration: `${durationMs}ms`,
          animationDelay: `-${Math.round(durationMs * 0.18 * (rowIndex + 1))}ms`,
        }}
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

export function CardMarquee({
  rows,
}: Readonly<{
  rows: readonly (readonly MarqueeCard[])[];
}>) {
  const { prefersSimplifiedMotion } = useMotionPreferences();
  const previewColorPreset = usePreviewColorPreset();
  const marqueeReveal = buildFadeUpVariants({
    reducedMotion: prefersSimplifiedMotion,
    distance: 30,
    duration: 0.7,
  });

  return (
    <motion.section
      aria-hidden="true"
      className="relative py-16"
      variants={marqueeReveal}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
    >
      <div className="gold-line-thick mx-auto mb-10 max-w-[70%]" />

      <div className="space-y-6">
        {rows.map((row, index) => (
          <MarqueeRow
            key={"marquee-row-" + (row[0]?.key ?? `row-${row.length}`)}
            cards={row}
            durationMs={getRowDurationMs(row.length, index)}
            previewColorPreset={previewColorPreset}
            rowIndex={index}
            reverse={index % 2 === 1}
            simplified={prefersSimplifiedMotion}
          />
        ))}
      </div>

      <div className="gold-line-thick mx-auto mt-10 max-w-[70%]" />
    </motion.section>
  );
}
