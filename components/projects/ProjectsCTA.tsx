"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  getMotionSafeAnimation,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

export function ProjectsCTA() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const containerVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.12,
  });
  const fadeIn = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 28,
    duration: 0.75,
  });
  const lineExpand = {
    hidden: { scaleX: prefersReducedMotion ? 1 : 0 },
    visible: {
      scaleX: 1,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : { duration: 1, ease: EASE_OUT_EXPO },
    },
  };

  return (
    <section className="relative overflow-hidden px-6 py-28 sm:px-12 md:py-36">
      {/* Radial spotlight glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--gold) / 0.07), transparent)",
        }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        {/* Top ornamental line */}
        <motion.div
          variants={lineExpand}
          className="mx-auto mb-12 h-px max-w-20 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.6), transparent)",
          }}
        />

        <motion.p
          variants={fadeIn}
          className="mb-5 font-mono text-[0.6rem] tracking-[0.5em] text-gold/50 uppercase"
        >
          ◆ Continue Here
        </motion.p>

        <motion.h2
          variants={fadeIn}
          className="
            mb-4 font-display text-4xl leading-[0.9] text-foreground
            sm:text-5xl
            md:text-6xl
          "
        >
          START WITH
          <br />
          <span className="text-gold">A PROFILE</span>
        </motion.h2>

        <motion.div
          variants={lineExpand}
          className="mx-auto mb-8 h-0.5 max-w-10 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)",
          }}
        />

        <motion.p
          variants={fadeIn}
          className="
            mx-auto mb-12 max-w-xl font-body-serif text-sm leading-[1.85] text-foreground/40
            sm:text-base
          "
        >
          Projects explain the ecosystem. The real next step is inside AniCards:
          search any public AniList username or ID, browse working card
          examples, or open the code once you&apos;re ready to contribute.
        </motion.p>

        <motion.div
          variants={fadeIn}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap"
        >
          <motion.div
            variants={fadeIn}
            whileHover={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 1.04,
              transition: { duration: 0.25, ease: EASE_OUT_EXPO },
            })}
            whileTap={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 0.97,
            })}
          >
            <Button asChild className="imperial-btn imperial-btn-fill">
              <Link href="/search" className="group flex items-center gap-2">
                <Search className="size-4" />
                Search a Profile
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeIn}
            whileHover={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 1.04,
              transition: { duration: 0.25, ease: EASE_OUT_EXPO },
            })}
            whileTap={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 0.97,
            })}
          >
            <Button asChild className="imperial-btn imperial-btn-ghost">
              <Link href="/examples" className="group flex items-center gap-2">
                Browse Examples
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeIn}
            whileHover={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 1.04,
              transition: { duration: 0.25, ease: EASE_OUT_EXPO },
            })}
            whileTap={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 0.97,
            })}
          >
            <Button asChild className="imperial-btn imperial-btn-ghost">
              <a
                href="https://github.com/RLAlpha49"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2"
              >
                <SimpleGithubIcon size={20} />
                Visit My GitHub
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </motion.div>
        </motion.div>

        {/* Bottom ornamental line */}
        <motion.div
          variants={lineExpand}
          className="mx-auto mt-12 h-px max-w-20 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.4), transparent)",
          }}
        />
      </motion.div>
    </section>
  );
}
