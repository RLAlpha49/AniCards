"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { CardPreviewPlaceholder } from "@/components/CardPreviewPlaceholder";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";
import { selectThemePreviewUrl } from "@/lib/preview-theme";
import { safeTrack, trackButtonClick } from "@/lib/utils/google-analytics";

interface HeroCard {
  cardType: string;
  height: number;
  previewUrls: {
    dark: string;
    light: string;
  };
  rotate: number;
  width: number;
  z: number;
}

export function HeroSection({
  cards,
  totalCardTypes,
}: Readonly<{
  cards: readonly HeroCard[];
  totalCardTypes: number;
}>) {
  const previewColorPreset = usePreviewColorPreset();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const formattedCardTypeCount = totalCardTypes.toLocaleString();
  const staggerContainer = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.12,
    delayChildren: 0.1,
  });
  const fadeUp = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 30,
    duration: 0.8,
  });
  const cardFloat = {
    hidden: prefersReducedMotion
      ? { opacity: 1, scale: 1, y: 0 }
      : { opacity: 0, scale: 0.85, y: 40 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : {
            duration: 0.9,
            delay: 0.4 + i * 0.15,
            ease: EASE_OUT_EXPO,
          },
    }),
  };

  const handleGetStartedClick = () => {
    safeTrack(() => trackButtonClick("get_started", "homepage_hero"));
  };

  return (
    <section className="relative min-h-home-hero overflow-hidden px-6 sm:px-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="
          absolute top-1/4 left-1/2 size-150 -translate-1/2 rounded-full bg-[hsl(var(--gold)/0.06)]
          blur-[120px]
        " />
      </div>

      <div className="
        relative z-10 mx-auto grid max-w-7xl items-center gap-12 pt-20 pb-16
        md:grid-cols-[1fr_1.1fr] md:gap-8 md:pt-28
        lg:gap-16
      ">
        <motion.div
          variants={staggerContainer}
          initial={false}
          animate="visible"
        >
          <motion.p
            variants={fadeUp}
            className="mb-5 text-[0.65rem] tracking-[0.6em] text-gold uppercase sm:text-xs"
          >
            Your AniList Stats, Distilled
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="
              mb-6 font-display text-4xl leading-[1.1] font-black text-foreground
              sm:text-5xl
              lg:text-6xl
              xl:text-7xl
            "
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
            className="
              mb-10 max-w-md font-body-serif text-base/relaxed text-foreground/50
              sm:text-lg
            "
          >
            Sharp stat cards pulled straight from your AniList profile. Deep
            analytics, bold visuals — and every detail is yours to tweak.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href="/search"
              onClick={handleGetStartedClick}
              className="imperial-btn imperial-btn-fill"
            >
              Get Started
            </Link>
            <Link href="/examples" className="imperial-btn imperial-btn-ghost">
              View Gallery
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="
              mt-10 flex flex-wrap gap-6 text-[0.65rem] tracking-[0.2em] text-foreground/35
              uppercase
            "
          >
            <span>✦ Always Free</span>
            <span>✦ No Sign-Up</span>
            <span>✦ {formattedCardTypeCount} Card Types</span>
          </motion.div>
        </motion.div>

        <div className="
          relative mx-auto flex h-90 w-full max-w-lg items-center justify-center
          sm:h-105
          md:h-120
        ">
          {cards.map((card, i) => {
            const previewUrl = selectThemePreviewUrl(
              card.previewUrls,
              previewColorPreset,
            );
            const isPriorityPreview = i === 0;

            return (
              <motion.div
                key={card.cardType}
                custom={i}
                variants={cardFloat}
                initial={false}
                animate="visible"
                className="absolute hero-card-float shadow-2xl shadow-black/20 dark:shadow-black/50"
                style={{
                  rotate: `${card.rotate}deg`,
                  zIndex: card.z,
                  top: `${10 + i * 12}%`,
                  left: `${5 + i * 18}%`,
                  width: "clamp(200px, 55%, 320px)",
                }}
              >
                <div className="overflow-hidden rounded-lg border-2 border-[hsl(var(--gold)/0.2)]">
                  {previewUrl ? (
                    <ImageWithSkeleton
                      src={previewUrl}
                      alt={`${card.cardType} preview`}
                      className="h-auto w-full"
                      width={card.width}
                      height={card.height}
                      loading={isPriorityPreview ? "eager" : "lazy"}
                      decoding={isPriorityPreview ? "auto" : "async"}
                      fetchPriority={isPriorityPreview ? "high" : undefined}
                      mode="lightweight"
                    />
                  ) : (
                    <CardPreviewPlaceholder
                      className="w-full"
                      aspectRatio={card.width / card.height}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
