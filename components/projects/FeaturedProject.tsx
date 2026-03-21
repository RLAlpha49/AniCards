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
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const expandWidth = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function FeaturedProject() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mb-16 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase sm:text-xs"
        >
          <span className="text-gold/50">§ 01</span>
          <span className="bg-gold/20 inline-block h-px max-w-20 flex-1" />
          <span className="text-foreground/30">The Main Event</span>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {/* Asymmetric layout: huge numeral + content */}
          <div className="grid items-start gap-8 md:grid-cols-[auto_1fr] md:gap-14 lg:gap-20">
            {/* Giant numeral column */}
            <motion.div
              variants={slideUp}
              className="hidden md:block"
              aria-hidden="true"
            >
              <span className="font-display text-gold/8 block text-[12rem] leading-none lg:text-[16rem]">
                01
              </span>
            </motion.div>

            {/* Content column */}
            <div className="relative">
              {/* Top accent line */}
              <motion.div
                variants={expandWidth}
                className="mb-8 h-0.5 origin-left"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(var(--gold)), transparent)",
                }}
              />

              <motion.div
                variants={slideUp}
                className="mb-4 flex items-center gap-4"
              >
                <div className="border-gold/25 bg-gold/5 flex h-11 w-11 items-center justify-center border">
                  <SimpleGithubIcon size={22} className="text-gold" />
                </div>
                <div>
                  <p className="text-gold/50 font-mono text-[0.6rem] tracking-[0.3em] uppercase">
                    You're looking at it
                  </p>
                  <h3 className="font-display text-foreground text-xl tracking-[0.12em] uppercase sm:text-2xl">
                    {FEATURED_PROJECT.name}
                  </h3>
                </div>
              </motion.div>

              <motion.p
                variants={slideUp}
                className="font-body-serif text-foreground/55 mb-3 max-w-xl text-sm leading-[1.8] sm:text-base"
              >
                {FEATURED_PROJECT.highlight}
              </motion.p>

              <motion.p
                variants={slideUp}
                className="font-body-serif text-foreground/40 mb-8 max-w-xl text-sm leading-[1.8]"
              >
                {FEATURED_PROJECT.description}
              </motion.p>

              {/* Tags as inline specimens */}
              <motion.div
                variants={slideUp}
                className="mb-10 flex flex-wrap gap-3"
              >
                {FEATURED_PROJECT.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border-gold/20 text-foreground/50 hover:border-gold/40 hover:text-foreground/70 border bg-transparent px-4 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
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

              {/* Bottom border detail */}
              <motion.div
                variants={expandWidth}
                className="mt-10 h-px origin-left"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent 70%)",
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
