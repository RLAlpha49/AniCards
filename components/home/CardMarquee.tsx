"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";

import { CardPreviewPlaceholder } from "@/components/CardPreviewPlaceholder";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { EASE_OUT_EXPO, VIEWPORT_ONCE } from "@/lib/animations";
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

export function CardMarquee({
  rows,
}: Readonly<{
  rows: readonly (readonly MarqueeCard[])[];
}>) {
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
        {rows.map((row, index) => (
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
