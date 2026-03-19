"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

import { FEATURED_PROJECT } from "./constants";

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" as const },
  },
};

export function FeaturedProject() {
  return (
    <section className="relative px-6 py-16 sm:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <div className="gold-ornament mb-6">
            <span className="text-gold text-lg">❖</span>
          </div>
          <h2 className="font-display text-foreground mb-3 text-sm tracking-[0.3em] uppercase">
            Flagship Project
          </h2>
          <div className="gold-line mx-auto max-w-12" />
        </motion.div>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          <div className="imperial-card group relative overflow-hidden p-0 transition-all duration-500 hover:-translate-y-1">
            <div className="pointer-events-none absolute top-0 right-0 select-none">
              <span className="font-display text-gold/4 block text-[12rem] leading-none sm:text-[16rem] md:text-[20rem]">
                {FEATURED_PROJECT.numeral}
              </span>
            </div>

            <div className="relative z-10 grid gap-0 md:grid-cols-[1fr_auto]">
              <div className="p-8 sm:p-10 md:p-12">
                <div className="mb-6 flex items-center gap-4">
                  <div className="border-gold/30 bg-gold/5 border p-3">
                    <SimpleGithubIcon size={28} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="font-display text-foreground text-lg tracking-[0.15em] uppercase sm:text-xl">
                      {FEATURED_PROJECT.name}
                    </h3>
                    <p className="text-gold/70 text-xs tracking-[0.3em] uppercase">
                      This very site
                    </p>
                  </div>
                </div>

                <div className="gold-line mb-6 max-w-12" />

                <p className="font-body-serif text-foreground/60 mb-4 max-w-lg text-sm leading-relaxed sm:text-base">
                  {FEATURED_PROJECT.highlight}
                </p>
                <p className="font-body-serif text-foreground/45 mb-8 max-w-lg text-sm leading-relaxed">
                  {FEATURED_PROJECT.description}
                </p>

                <div className="mb-8 flex flex-wrap gap-2">
                  {FEATURED_PROJECT.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border-gold/25 text-foreground/55 border px-3 py-1.5 text-xs tracking-wider uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4">
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
                      View Examples
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="border-gold/10 hidden items-center justify-center border-l px-12 md:flex">
                <div className="text-center">
                  <span className="font-display text-gold/20 block text-7xl">
                    {FEATURED_PROJECT.numeral}
                  </span>
                  <div className="gold-line mx-auto mt-3 max-w-8" />
                  <p className="text-foreground/30 mt-3 text-xs tracking-[0.3em] uppercase">
                    Flagship
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
