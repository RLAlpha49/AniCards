"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowDown, Layers, LayoutGrid, Palette, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

interface HeroSectionProps {
  totalCardTypes: number;
  totalVariants: number;
  categoryCount: number;
  onStartCreating: () => void;
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function AnimatedCounter({ target }: Readonly<{ target: number }>) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    motionVal.set(target);
  }, [motionVal, target]);

  useEffect(() => {
    const unsub = display.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
    return unsub;
  }, [display]);

  return <span ref={ref}>0</span>;
}

const STATS = [
  { key: "types", label: "Card Types", icon: LayoutGrid, suffix: "" },
  { key: "variants", label: "Variants", icon: Layers, suffix: "+" },
  { key: "categories", label: "Categories", icon: Palette, suffix: "" },
] as const;

export function ExamplesHeroSection({
  totalCardTypes,
  totalVariants,
  categoryCount,
  onStartCreating,
}: Readonly<HeroSectionProps>) {
  const values: Record<string, number> = {
    types: totalCardTypes,
    variants: totalVariants,
    categories: categoryCount,
  };

  const scrollToGallery = () => {
    const el = document.getElementById("card-gallery");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus();
      el.addEventListener("blur", () => el.removeAttribute("tabindex"), {
        once: true,
      });
    }
  };

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-14 sm:px-12 md:pt-36 md:pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-120 w-175 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[100px]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        <motion.p
          variants={fadeUp}
          className="text-gold mb-6 text-[0.6rem] tracking-[0.55em] uppercase sm:text-[0.7rem]"
        >
          The Gallery
        </motion.p>

        <motion.h1
          variants={fadeUp}
          className="font-display text-foreground mb-5 text-4xl leading-[1.08] font-black sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Card <span className="text-gold">Showcase</span>
        </motion.h1>

        <motion.div
          variants={fadeUp}
          className="gold-line-thick mx-auto mb-6 max-w-16"
        />

        <motion.p
          variants={fadeUp}
          className="font-body-serif text-foreground/50 mx-auto mb-10 max-w-md text-base leading-relaxed sm:text-lg"
        >
          Every card type, every variant — rendered live from{" "}
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
          variants={fadeUp}
          className="divide-gold/15 mb-10 inline-flex items-center divide-x"
        >
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.key}
                className="flex items-center gap-2 px-6 first:pl-0 last:pr-0 sm:px-8"
              >
                <Icon className="text-gold/50 hidden h-3.5 w-3.5 sm:block" />
                <div className="text-left">
                  <p className="font-display text-gold text-xl leading-none font-bold sm:text-2xl">
                    <AnimatedCounter target={values[stat.key]} />
                    {stat.suffix}
                  </p>
                  <p className="text-foreground/30 text-[0.55rem] tracking-[0.15em] uppercase sm:text-[0.6rem]">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <button
            onClick={onStartCreating}
            className="imperial-btn imperial-btn-fill inline-flex items-center"
          >
            <Sparkles className="mr-2 h-4 w-4" />
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
      </motion.div>
    </section>
  );
}
