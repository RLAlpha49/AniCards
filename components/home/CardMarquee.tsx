"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";

import { CardPreviewPlaceholder } from "@/components/CardPreviewPlaceholder";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { buildFadeUpVariants, VIEWPORT_ONCE } from "@/lib/animations";
import { selectThemePreviewUrl } from "@/lib/preview-theme";

const MARQUEE_DURATION_MS = 45_000;
const useIsomorphicLayoutEffect =
  globalThis.window === undefined ? useEffect : useLayoutEffect;

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
  interactive = true,
  previewColorPreset,
}: Readonly<{
  cards: readonly MarqueeCard[];
  interactive?: boolean;
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
                className={
                  interactive
                    ? `
                      block size-full rounded-lg! border border-[hsl(var(--gold)/0.12)]
                      object-contain transition-all duration-200
                      hover:scale-[1.03] hover:border-[hsl(var(--gold)/0.35)]
                      hover:shadow-[0_0_12px_hsl(var(--gold)/0.15)]
                    `
                    : `
                      block size-full rounded-lg! border border-[hsl(var(--gold)/0.12)]
                      object-contain
                    `
                }
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
  simplified = false,
}: Readonly<{
  cards: readonly MarqueeCard[];
  durationMs: number;
  previewColorPreset: ReturnType<typeof usePreviewColorPreset>;
  reverse?: boolean;
  simplified?: boolean;
}>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const orderedCards = reverse ? [...cards].reverse() : cards;

  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current;
    const currentWindow = globalThis.window;
    if (simplified || !track || !currentWindow) return;

    track.style.animationDelay = `-${currentWindow.performance.now() % durationMs}ms`;
  }, [durationMs, simplified]);

  if (simplified) {
    return (
      <div className="overflow-x-auto py-3" aria-hidden="true">
        <MarqueeGroup
          cards={orderedCards}
          interactive={false}
          previewColorPreset={previewColorPreset}
        />
      </div>
    );
  }

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
            reverse={index % 2 === 1}
            simplified={prefersSimplifiedMotion}
          />
        ))}
      </div>

      <div className="gold-line-thick mx-auto mt-10 max-w-[70%]" />
    </motion.section>
  );
}
