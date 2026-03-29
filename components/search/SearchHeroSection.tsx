"use client";

import { motion, useReducedMotion } from "framer-motion";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
} from "@/lib/animations";

import { SearchForm } from "./SearchForm";

interface SearchHeroSectionProps {
  onLoadingChange: (loading: boolean) => void;
}

export function SearchHeroSection({
  onLoadingChange,
}: Readonly<SearchHeroSectionProps>) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const containerVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.1,
  });
  const itemVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 28,
    duration: 0.7,
  });

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-24 sm:px-12 md:pt-36 md:pb-32">
      {/* Concentric ring background — sonar/radar motif */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 42%,
              transparent 8%,
              hsl(var(--gold) / 0.04) 8.3%, transparent 8.6%,
              transparent 16%,
              hsl(var(--gold) / 0.03) 16.3%, transparent 16.6%,
              transparent 24%,
              hsl(var(--gold) / 0.025) 24.3%, transparent 24.6%,
              transparent 32%,
              hsl(var(--gold) / 0.02) 32.3%, transparent 32.6%,
              transparent 40%,
              hsl(var(--gold) / 0.015) 40.3%, transparent 40.6%,
              transparent 48%,
              hsl(var(--gold) / 0.01) 48.3%, transparent 48.6%)
          `,
        }}
      />

      {/* Central gold glow */}
      <div className="
        pointer-events-none absolute top-1/3 left-1/2 h-125 w-150 -translate-1/2 rounded-full
        bg-[hsl(var(--gold)/0.06)] blur-[140px]
      " />

      {/* Floating decorative elements */}
      <motion.div
        className="pointer-events-none absolute top-24 left-[8%] text-5xl text-gold/10 select-none"
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, -15, 0], rotate: [0, 12, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 9, repeat: Infinity, ease: "easeInOut" }
        }
      >
        ◆
      </motion.div>
      <motion.div
        className="
          pointer-events-none absolute right-[10%] bottom-32 text-3xl text-gold/8 select-none
        "
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, 12, 0], rotate: [0, -8, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }
        }
      >
        ✦
      </motion.div>
      <motion.div
        className="
          pointer-events-none absolute top-[50%] left-[5%] hidden text-2xl text-gold/6 select-none
          md:block
        "
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }
        }
      >
        ◇
      </motion.div>
      <motion.div
        className="
          pointer-events-none absolute top-[20%] right-[6%] hidden text-xl text-gold/5 select-none
          lg:block
        "
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, 8, 0], rotate: [0, -15, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 3,
              }
        }
      >
        ◇
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <motion.p
          variants={itemVariants}
          className="mb-5 text-xs tracking-[0.6em] text-gold uppercase sm:text-sm"
        >
          Profile Lookup
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="
            mb-6 font-display text-5xl leading-[1.05] font-black
            sm:text-6xl
            md:text-7xl
            lg:text-8xl
          "
        >
          <span className="block text-foreground">UNLOCK</span>
          <span className="block text-gold">ANY PROFILE</span>
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="gold-line-thick mx-auto mb-8 max-w-32"
        />

        <motion.p
          variants={itemVariants}
          className="
            mx-auto mb-6 max-w-lg font-body-serif text-base/relaxed text-foreground/45
            sm:text-lg
          "
        >
          Punch in a username or ID, and we&apos;ll pull together stunning stat
          cards from any public AniList profile — ready to customize and share
          wherever you like.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="
            mb-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs tracking-[0.2em]
            text-foreground/30 uppercase
          "
        >
          <span>✦ Instant Results</span>
          <span>✦ No Account Needed</span>
          <span>✦ One-Click Setup</span>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SearchForm onLoadingChange={onLoadingChange} />
        </motion.div>
      </motion.div>
    </section>
  );
}
