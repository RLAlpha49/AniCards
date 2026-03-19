"use client";

import { motion } from "framer-motion";
import { ArrowDown, Layers, LayoutGrid, Palette, Play } from "lucide-react";

interface HeroSectionProps {
  totalCardTypes: number;
  totalVariants: number;
  categoryCount: number;
  onStartCreating: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

const STATS_CONFIG = [
  { key: "types", label: "Card Types", icon: LayoutGrid },
  { key: "variants", label: "Variants", icon: Layers },
  { key: "categories", label: "Categories", icon: Palette },
] as const;

export function ExamplesHeroSection({
  totalCardTypes,
  totalVariants,
  categoryCount,
  onStartCreating,
}: Readonly<HeroSectionProps>) {
  const statValues: Record<string, string> = {
    types: String(totalCardTypes),
    variants: `${totalVariants}+`,
    categories: String(categoryCount),
  };

  const scrollToGallery = () => {
    const gallery = document.getElementById("card-gallery");
    if (gallery) {
      gallery.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!gallery.hasAttribute("tabindex")) {
        gallery.setAttribute("tabindex", "-1");
      }
      gallery.focus();
      gallery.addEventListener(
        "blur",
        () => gallery.removeAttribute("tabindex"),
        { once: true },
      );
    }
  };

  return (
    <section className="relative w-full overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-gold/4 absolute top-1/4 left-1/2 h-125 w-175 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl"
      >
        <motion.div
          variants={itemVariants}
          className="gold-ornament mb-10 text-center"
        >
          <span className="text-gold text-xl">❖</span>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-gold mb-5 text-center text-[0.65rem] tracking-[0.6em] uppercase sm:text-xs"
        >
          The Collection
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="font-display text-foreground mx-auto mb-7 max-w-2xl text-center text-4xl leading-[1.1] font-black sm:text-5xl md:text-6xl lg:text-7xl"
        >
          EVERY CARD
          <br />
          <span className="text-gold">EVERY STYLE</span>
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="gold-line-thick mx-auto mb-7 max-w-24"
        />

        <motion.p
          variants={itemVariants}
          className="font-body-serif text-foreground/50 mx-auto mb-12 max-w-lg text-center text-base leading-relaxed sm:text-lg"
        >
          Browse the complete gallery — real data, every variant, one page. All
          examples rendered from{" "}
          <a
            href="https://anilist.co/user/Alpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold/80 font-semibold transition-colors hover:underline"
          >
            @Alpha49
          </a>
          .
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="mb-16 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <button
            onClick={onStartCreating}
            className="imperial-btn imperial-btn-fill inline-flex items-center"
          >
            <Play className="mr-2 h-4 w-4 fill-current" />
            Create Your Cards
          </button>
          <button
            onClick={scrollToGallery}
            className="imperial-btn imperial-btn-ghost inline-flex items-center"
          >
            Browse Gallery
            <ArrowDown className="ml-2 h-4 w-4" />
          </button>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="border-gold/15 mx-auto flex max-w-xl items-stretch justify-center border"
        >
          {STATS_CONFIG.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.key}
                className={`flex flex-1 flex-col items-center gap-1.5 py-5 ${i < STATS_CONFIG.length - 1 ? "border-gold/15 border-r" : ""}`}
              >
                <Icon className="text-gold/60 h-4 w-4" />
                <span className="font-display text-gold text-2xl font-bold sm:text-3xl">
                  {statValues[stat.key]}
                </span>
                <span className="text-foreground/40 text-[0.6rem] tracking-[0.2em] uppercase">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
