"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback } from "react";

import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import {
  buildCardUrlWithParams,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import { buildApiUrl } from "@/lib/utils";
import { safeTrack, trackButtonClick } from "@/lib/utils/google-analytics";

const BASE_URL = buildApiUrl("/card.svg");

const HERO_CARDS = [
  { cardType: "animeStats", variation: "default", rotate: -6, z: 3 },
  { cardType: "animeGenres", variation: "pie", rotate: 4, z: 2 },
  { cardType: "socialStats", variation: "default", rotate: -2, z: 1 },
];

function buildPreviewSrc(
  cardType: string,
  variation: string,
  colorPreset: string,
) {
  return buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(
      {
        cardName: cardType,
        variation,
        colorPreset,
      },
      { userId: DEFAULT_EXAMPLE_USER_ID, includeColors: false },
    ),
    BASE_URL,
  );
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const cardFloat = {
  hidden: { opacity: 0, scale: 0.85, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.9,
      delay: 0.4 + i * 0.15,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export function HeroSection() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const colorPreset =
    resolvedTheme === "dark" ? "anicardsDarkGradient" : "anicardsLightGradient";

  const handleGetStarted = useCallback(() => {
    safeTrack(() => trackButtonClick("get_started", "homepage_hero"));
    router.push("/search");
  }, [router]);

  return (
    <section className="relative min-h-[90vh] overflow-hidden px-6 sm:px-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.06)] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 pt-20 pb-16 md:grid-cols-[1fr_1.1fr] md:gap-8 md:pt-28 lg:gap-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.p
            variants={fadeUp}
            className="text-gold mb-5 text-[0.65rem] tracking-[0.6em] uppercase sm:text-xs"
          >
            Your AniList Stats, Distilled
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="font-display text-foreground mb-6 text-4xl leading-[1.1] font-black sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            YOUR ANIME
            <br />
            STORY,{" "}
            <span className="text-gold">
              CARVED
              <br className="hidden sm:block" /> IN GOLD
            </span>
          </motion.h1>

          <motion.div
            variants={fadeUp}
            className="gold-line-thick mb-6 max-w-20"
          />

          <motion.p
            variants={fadeUp}
            className="font-body-serif text-foreground/50 mb-10 max-w-md text-base leading-relaxed sm:text-lg"
          >
            Sharp stat cards pulled straight from your AniList profile. Deep
            analytics, bold visuals — and every detail is yours to tweak.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <button
              onClick={handleGetStarted}
              className="imperial-btn imperial-btn-fill"
            >
              Get Started
            </button>
            <Link href="/examples" className="imperial-btn imperial-btn-ghost">
              View Gallery
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="text-foreground/35 mt-10 flex flex-wrap gap-6 text-[0.65rem] tracking-[0.2em] uppercase"
          >
            <span>✦ Always Free</span>
            <span>✦ No Sign-Up</span>
            <span>✦ 20+ Card Types</span>
          </motion.div>
        </motion.div>

        <div className="relative mx-auto flex h-90 w-full max-w-lg items-center justify-center sm:h-105 md:h-120">
          {HERO_CARDS.map((card, i) => (
            <motion.div
              key={card.cardType}
              custom={i}
              variants={cardFloat}
              initial="hidden"
              animate="visible"
              className="hero-card-float absolute rounded-lg shadow-2xl shadow-black/20 dark:shadow-black/50"
              style={{
                rotate: `${card.rotate}deg`,
                zIndex: card.z,
                top: `${10 + i * 12}%`,
                left: `${5 + i * 18}%`,
                width: "clamp(200px, 55%, 320px)",
              }}
            >
              <div className="overflow-hidden rounded-lg border-2 border-[hsl(var(--gold)/0.2)]">
                <ImageWithSkeleton
                  src={buildPreviewSrc(
                    card.cardType,
                    card.variation,
                    colorPreset,
                  )}
                  alt={`${card.cardType} preview`}
                  className="h-auto w-full"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
