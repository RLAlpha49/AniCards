"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

import { FEATURED_PROJECT } from "./constants";

export function FeaturedProject() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section label — left-aligned with extending line */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 flex items-center gap-4"
        >
          <span className="font-display text-gold/60 text-xs tracking-[0.4em] uppercase">
            № 01 — Flagship
          </span>
          <div className="h-px flex-1 bg-[hsl(var(--gold)/0.1)]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <div className="imperial-card group relative overflow-hidden p-0 transition-all duration-500 hover:-translate-y-1">
            {/* Decorative background numeral anchored bottom-right */}
            <div className="pointer-events-none absolute -right-4 -bottom-8 select-none">
              <span className="font-display block text-[18rem] leading-none text-[hsl(var(--gold)/0.03)] sm:text-[24rem]">
                {FEATURED_PROJECT.numeral}
              </span>
            </div>

            {/* Content grid */}
            <div className="relative z-10 grid gap-0 lg:grid-cols-[1fr_280px]">
              {/* Main content */}
              <div className="p-8 sm:p-10 lg:p-14">
                <div className="mb-8 flex items-start gap-5">
                  <div className="border-gold/30 bg-gold/5 shrink-0 border p-3.5">
                    <SimpleGithubIcon size={28} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="font-display text-foreground text-xl tracking-[0.15em] uppercase sm:text-2xl">
                      {FEATURED_PROJECT.name}
                    </h3>
                    <p className="text-gold/60 mt-1 text-xs tracking-[0.3em] uppercase">
                      This very site
                    </p>
                  </div>
                </div>

                <div className="gold-line mb-8 max-w-16" />

                {/* Pull-quote treatment for highlight */}
                <blockquote className="border-gold/20 mb-6 border-l-2 pl-5">
                  <p className="font-body-serif text-foreground/70 text-base leading-relaxed italic sm:text-lg">
                    &ldquo;{FEATURED_PROJECT.highlight}&rdquo;
                  </p>
                </blockquote>

                <p className="font-body-serif text-foreground/45 mb-10 max-w-xl text-sm leading-relaxed">
                  {FEATURED_PROJECT.description}
                </p>

                {/* Tags */}
                <div className="mb-10 flex flex-wrap gap-2.5">
                  {FEATURED_PROJECT.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border-gold/20 text-foreground/50 border px-3.5 py-1.5 text-xs tracking-wider uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
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

              {/* Right decorative panel */}
              <div className="border-gold/10 hidden items-center justify-center border-l lg:flex">
                <div className="text-center">
                  <span className="font-display text-gold/15 block text-8xl">
                    {FEATURED_PROJECT.numeral}
                  </span>
                  <div className="gold-line mx-auto mt-4 max-w-10" />
                  <p className="text-foreground/25 mt-4 text-xs tracking-[0.4em] uppercase">
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
