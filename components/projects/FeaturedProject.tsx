"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

import { FEATURED_PROJECT } from "./constants";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const slideUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const expandWidth = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const scaleIn = {
  hidden: { scale: 0.92, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function FeaturedProject() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase sm:text-xs"
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
            className="pointer-events-none absolute -top-3 -left-3 h-12 w-12 border-t-2 border-l-2 opacity-40 transition-opacity duration-500 group-hover:opacity-80"
            style={{ borderColor: "hsl(var(--gold))" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-3 -bottom-3 h-12 w-12 border-r-2 border-b-2 opacity-40 transition-opacity duration-500 group-hover:opacity-80"
            style={{ borderColor: "hsl(var(--gold))" }}
            aria-hidden="true"
          />

          <div className="border-gold/15 bg-card/60 hover:border-gold/30 overflow-hidden border-2 backdrop-blur-sm transition-all duration-500">
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
                  <div className="border-gold/30 bg-gold/5 group-hover:border-gold/50 group-hover:bg-gold/10 flex h-12 w-12 items-center justify-center border transition-colors duration-300">
                    <SimpleGithubIcon size={24} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-gold/50 font-mono text-[0.55rem] tracking-[0.4em] uppercase">
                      You&apos;re looking at it
                    </p>
                    <h3 className="font-display text-foreground text-2xl tracking-widest uppercase sm:text-3xl">
                      {FEATURED_PROJECT.name}
                    </h3>
                  </div>
                </motion.div>

                <motion.p
                  variants={slideUp}
                  className="font-body-serif text-foreground/55 mb-3 max-w-2xl text-sm leading-[1.85] sm:text-base"
                >
                  {FEATURED_PROJECT.highlight}
                </motion.p>

                <motion.p
                  variants={slideUp}
                  className="font-body-serif text-foreground/35 mb-8 max-w-2xl text-sm leading-[1.85]"
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
                      className="border-gold/15 text-foreground/45 hover:border-gold/40 hover:text-gold/80 border px-4 py-1.5 font-mono text-[0.6rem] tracking-[0.2em] uppercase transition-all duration-300"
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
                      className="flex items-center gap-2"
                    >
                      <Star className="h-4 w-4" />
                      Star on GitHub
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </Button>
                  <Button asChild className="imperial-btn imperial-btn-ghost">
                    <Link href="/examples" className="flex items-center gap-2">
                      See It in Action
                    </Link>
                  </Button>
                </motion.div>
              </div>

              {/* Right decorative column — spec plate */}
              <motion.div
                variants={slideUp}
                className="hidden min-w-48 md:block"
                aria-hidden="true"
              >
                <div className="border-gold/10 border-l pl-8">
                  <span className="font-display text-gold/6 block text-[9rem] leading-none lg:text-[11rem]">
                    01
                  </span>
                  <div
                    className="mt-4 h-px max-w-16"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
                    }}
                  />
                  <p className="text-foreground/20 mt-4 font-mono text-[0.55rem] tracking-[0.3em] uppercase">
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
