"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

interface HeroSectionProps {
  totalCardTypes: number;
  totalVariants: number;
  categoryCount: number;
  onStartCreating: () => void;
}

const orchestrate = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const riseIn = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const scaleReveal = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function AnimatedNumber({ target }: Readonly<{ target: number }>) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 22 });
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

export function ExamplesHeroSection({
  totalCardTypes,
  totalVariants,
  categoryCount,
  onStartCreating,
}: Readonly<HeroSectionProps>) {
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
    <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
      {/* Atmospheric background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--gold)/0.08),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 h-1/2 w-full bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,hsl(var(--gold)/0.04),transparent_60%)]" />
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--foreground)) 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <motion.div
        variants={orchestrate}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-5xl"
      >
        {/* Overline */}
        <motion.div variants={riseIn} className="mb-8 flex items-center gap-4">
          <div className="h-px max-w-12 flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.5)]" />
          <span className="text-gold text-[0.6rem] tracking-[0.6em] uppercase sm:text-[0.65rem]">
            Showcase
          </span>
          <div className="h-px max-w-12 flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.5)]" />
        </motion.div>

        {/* Large number overlay */}
        <div className="relative">
          <motion.div
            variants={scaleReveal}
            className="pointer-events-none absolute -top-8 -left-2 select-none sm:-top-14 sm:-left-4"
          >
            <span className="font-display text-[8rem] leading-none font-black text-[hsl(var(--gold)/0.04)] sm:text-[12rem] md:text-[16rem]">
              <AnimatedNumber target={totalVariants} />
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={riseIn}
            className="font-display relative text-4xl leading-[1.05] font-black tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <span className="text-foreground">Every Card,</span>
            <br />
            <span className="text-gold">Every Variant</span>
          </motion.h1>
        </div>

        {/* Subtitle */}
        <motion.p
          variants={riseIn}
          className="font-body-serif text-foreground/45 mt-6 max-w-lg text-base leading-relaxed sm:text-lg"
        >
          Browse{" "}
          <span className="text-foreground/70 font-semibold">
            <AnimatedNumber target={totalCardTypes} /> distinct card types
          </span>{" "}
          spread across{" "}
          <span className="text-foreground/70 font-semibold">
            {categoryCount} categories
          </span>
          — all pulled live from{" "}
          <a
            href="https://anilist.co/user/Alpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold/80 transition-colors hover:underline"
          >
            @Alpha49
          </a>
          {"."}
        </motion.p>

        {/* Stats strip */}
        <motion.div
          variants={riseIn}
          className="mt-12 flex flex-wrap items-end gap-12 sm:gap-16"
        >
          {[
            { value: totalCardTypes, label: "Card Types" },
            { value: totalVariants, label: "Total Variants", suffix: "+" },
            { value: categoryCount, label: "Categories" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-gold text-3xl leading-none font-black sm:text-4xl">
                <AnimatedNumber target={stat.value} />
                {stat.suffix && (
                  <span className="text-gold/50 text-xl">{stat.suffix}</span>
                )}
              </p>
              <p className="text-foreground/30 mt-1.5 text-[0.6rem] tracking-[0.2em] uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Actions */}
        <motion.div
          variants={riseIn}
          className="mt-12 flex flex-wrap items-center gap-4"
        >
          <button
            onClick={onStartCreating}
            className="imperial-btn imperial-btn-fill inline-flex items-center"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Create Yours
          </button>
          <button
            onClick={scrollToGallery}
            className="imperial-btn imperial-btn-ghost group inline-flex items-center"
          >
            Browse the Gallery
            <ArrowDown className="ml-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
