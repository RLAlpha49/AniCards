"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Search, Star } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  buildScaleInVariants,
  EASE_OUT_EXPO,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

import { FEATURED_PROJECT } from "./constants";

export function FeaturedProject() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const labelFade = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 0,
    duration: 0.5,
  });
  const stagger = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.05,
  });
  const slideUp = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 30,
    duration: 0.7,
  });
  const expandWidth = {
    hidden: {
      scaleX: prefersReducedMotion ? 1 : 0,
      opacity: prefersReducedMotion ? 1 : 0,
    },
    visible: {
      scaleX: 1,
      opacity: 1,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : { duration: 0.9, ease: EASE_OUT_EXPO },
    },
  };
  const scaleIn = buildScaleInVariants({
    reducedMotion: prefersReducedMotion,
    initialScale: 0.92,
    y: 0,
    duration: 0.8,
  });

  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section label */}
        <motion.div
          variants={labelFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="
            mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase
            sm:text-xs
          "
        >
          <span className="text-gold/60">01</span>
          <span
            className="inline-block h-px max-w-16 flex-1"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
            }}
          />
          <span className="text-foreground/30">Flagship</span>
        </motion.div>

        {/* Case study card */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="group relative"
        >
          {/* Geometric frame — gold corner brackets */}
          <div
            className="
              pointer-events-none absolute -top-3 -left-3 size-12 border-t-2 border-l-2 opacity-40
              transition-opacity duration-500
              group-hover:opacity-80
            "
            style={{ borderColor: "hsl(var(--gold))" }}
            aria-hidden="true"
          />
          <div
            className="
              pointer-events-none absolute -right-3 -bottom-3 size-12 border-r-2 border-b-2
              opacity-40 transition-opacity duration-500
              group-hover:opacity-80
            "
            style={{ borderColor: "hsl(var(--gold))" }}
            aria-hidden="true"
          />

          <div className="
            overflow-hidden border-2 border-gold/15 bg-card/60 backdrop-blur-sm transition-all
            duration-500
            hover:border-gold/30
          ">
            {/* Gold accent bar at top */}
            <div
              className="h-1"
              style={{
                background:
                  "linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold) / 0.4) 60%, transparent)",
              }}
            />

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="grid gap-8 p-8 sm:p-10 md:grid-cols-[1fr_auto] md:gap-16 lg:p-14"
            >
              {/* Content column */}
              <div>
                <motion.div
                  variants={slideUp}
                  className="mb-6 flex items-center gap-4"
                >
                  <div className="
                    flex size-12 items-center justify-center border border-gold/30 bg-gold/5
                    transition-colors duration-300
                    group-hover:border-gold/50 group-hover:bg-gold/10
                  ">
                    <SimpleGithubIcon size={24} className="text-gold" />
                  </div>
                  <div>
                    <p className="font-mono text-[0.55rem] tracking-[0.4em] text-gold/50 uppercase">
                      You&apos;re looking at it
                    </p>
                    <h2 className="
                      font-display text-2xl tracking-widest text-foreground uppercase
                      sm:text-3xl
                    ">
                      {FEATURED_PROJECT.name}
                    </h2>
                  </div>
                </motion.div>

                <motion.p
                  variants={slideUp}
                  className="
                    mb-3 max-w-2xl font-body-serif text-sm leading-[1.85] text-foreground/55
                    sm:text-base
                  "
                >
                  {FEATURED_PROJECT.highlight}
                </motion.p>

                <motion.p
                  variants={slideUp}
                  className="
                    mb-8 max-w-2xl font-body-serif text-sm leading-[1.85] text-foreground/35
                  "
                >
                  {FEATURED_PROJECT.description}
                </motion.p>

                {/* Tags */}
                <motion.div
                  variants={slideUp}
                  className="mb-10 flex flex-wrap gap-3"
                >
                  {FEATURED_PROJECT.tags.map((tag) => (
                    <span
                      key={tag}
                      className="
                        border border-gold/15 px-4 py-1.5 font-mono text-[0.6rem] tracking-[0.2em]
                        text-foreground/45 uppercase transition-all duration-300
                        hover:border-gold/40 hover:text-gold/80
                      "
                    >
                      {tag}
                    </span>
                  ))}
                </motion.div>

                {/* Actions */}
                <motion.div variants={slideUp} className="flex flex-wrap gap-4">
                  <Button asChild className="imperial-btn imperial-btn-fill">
                    <a
                      href={FEATURED_PROJECT.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2"
                    >
                      <Star className="size-4" />
                      Star on GitHub
                      <ArrowRight className="
                        size-4 transition-transform
                        group-hover:translate-x-0.5
                      " />
                    </a>
                  </Button>
                  <Button asChild className="imperial-btn imperial-btn-ghost">
                    <Link
                      href="/search"
                      className="group flex items-center gap-2"
                    >
                      <Search className="size-4" />
                      Open Profile Search
                      <ArrowRight className="
                        size-4 transition-transform
                        group-hover:translate-x-0.5
                      " />
                    </Link>
                  </Button>
                </motion.div>

                <motion.p
                  variants={slideUp}
                  className="mt-4 font-body-serif text-sm leading-[1.75] text-foreground/35"
                >
                  Want to see what it does?{" "}
                  <Link
                    href="/examples"
                    className="
                      font-mono text-[0.65rem] tracking-[0.2em] text-gold/70 uppercase
                      transition-colors duration-300
                      hover:text-gold
                      focus-visible:text-gold focus-visible:underline
                      focus-visible:underline-offset-4
                    "
                  >
                    Browse the gallery
                  </Link>
                  .
                </motion.p>
              </div>

              {/* Right decorative column — spec plate */}
              <motion.div
                variants={slideUp}
                className="hidden min-w-48 md:block"
                aria-hidden="true"
              >
                <div className="border-l border-gold/10 pl-8">
                  <span className="
                    block font-display text-[9rem] leading-none text-gold/6
                    lg:text-[11rem]
                  ">
                    01
                  </span>
                  <div
                    className="mt-4 h-px max-w-16"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
                    }}
                  />
                  <p className="
                    mt-4 font-mono text-[0.55rem] tracking-[0.3em] text-foreground/20 uppercase
                  ">
                    Flagship
                    <br />
                    Project
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Bottom accent */}
            <motion.div
              variants={expandWidth}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="h-px origin-left"
              style={{
                background:
                  "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent 80%)",
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
