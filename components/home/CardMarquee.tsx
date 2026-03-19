"use client";

import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import {
  buildCardUrlWithParams,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import { buildApiUrl } from "@/lib/utils";

const BASE_URL = buildApiUrl("/card.svg");

const MARQUEE_CARDS = [
  { cardType: "animeStats", variation: "default" },
  { cardType: "mangaStats", variation: "default" },
  { cardType: "animeGenres", variation: "pie" },
  { cardType: "socialStats", variation: "default" },
  { cardType: "animeVoiceActors", variation: "default" },
  { cardType: "animeStudios", variation: "pie" },
  { cardType: "animeScoreDistribution", variation: "default" },
  { cardType: "animeTags", variation: "bar" },
];

function buildSrc(cardType: string, variation: string) {
  return buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(
      { cardName: cardType, variation, colorPreset: "anilistDarkGradient" },
      { userId: DEFAULT_EXAMPLE_USER_ID, includeColors: false },
    ),
    BASE_URL,
  );
}

function MarqueeRow({ reverse = false }: Readonly<{ reverse?: boolean }>) {
  const cards = reverse ? [...MARQUEE_CARDS].reverse() : MARQUEE_CARDS;

  return (
    <div className="marquee-row" aria-hidden="true">
      <div
        className={`marquee-track ${reverse ? "marquee-reverse" : "marquee-forward"}`}
      >
        {[...cards, ...cards].map((card, i) => {
          const src = buildSrc(card.cardType, card.variation);
          return (
            <div
              key={`${card.cardType}-${i}`}
              className="inline-flex h-auto w-auto shrink-0 items-center justify-center"
            >
              <a href={src} target="_blank" rel="noopener noreferrer">
                <ImageWithSkeleton
                  src={src}
                  alt=""
                  className="h-full w-auto rounded-lg! border border-[hsl(var(--gold)/0.12)] object-contain transition-all duration-200 hover:scale-[1.03] hover:border-[hsl(var(--gold)/0.35)] hover:shadow-[0_0_12px_hsl(var(--gold)/0.15)]"
                />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CardMarquee() {
  return (
    <section className="relative py-16">
      <div className="gold-line-thick mx-auto mb-10 max-w-[70%]" />

      <div className="space-y-6">
        <MarqueeRow />
        <MarqueeRow reverse />
      </div>

      <div className="gold-line-thick mx-auto mt-10 max-w-[70%]" />
    </section>
  );
}
