"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useEffect, useRef } from "react";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  buildScaleInVariants,
  getMotionSafeScrollBehavior,
} from "@/lib/animations";

interface HeroSectionProps {
  totalCardTypes: number;
  totalVariants: number;
  categoryCount: number;
  createHref: string;
}

const GALLERY_SECTION_ID = "card-gallery";
const GALLERY_HASH = `#${GALLERY_SECTION_ID}`;

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

function HeroStatNumber({
  reducedMotion,
  target,
}: Readonly<{ reducedMotion: boolean; target: number }>) {
  if (reducedMotion) {
    return <span>{target}</span>;
  }

  return <AnimatedNumber target={target} />;
}

export function ExamplesHeroSection({
  totalCardTypes,
  totalVariants,
  categoryCount,
  createHref,
}: Readonly<HeroSectionProps>) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const orchestrate = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.08,
    delayChildren: 0.15,
  });
  const riseIn = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 40,
    duration: 0.9,
  });
  const scaleReveal = buildScaleInVariants({
    reducedMotion: prefersReducedMotion,
    initialScale: 0.85,
    y: 0,
    duration: 1.1,
  });

  const getGalleryElement = (): HTMLElement | null => {
    const target = document.getElementById(GALLERY_SECTION_ID);

    return target instanceof HTMLElement ? target : null;
  };

  const focusGalleryElement = (target: HTMLElement) => {
    const addedTemporaryTabIndex = !target.hasAttribute("tabindex");

    if (addedTemporaryTabIndex) {
      target.setAttribute("tabindex", "-1");
    }

    target.focus({ preventScroll: true });

    if (addedTemporaryTabIndex) {
      target.addEventListener(
        "blur",
        () => target.removeAttribute("tabindex"),
        {
          once: true,
        },
      );
    }
  };

  const queueGalleryFocus = (target: HTMLElement) => {
    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => {
        focusGalleryElement(target);
      });
    });
  };

  const scrollToGallery = () => {
    const target = getGalleryElement();

    if (target) {
      target.scrollIntoView({
        behavior: getMotionSafeScrollBehavior(prefersReducedMotion),
        block: "start",
      });
      queueGalleryFocus(target);
    }
  };

  const updateGalleryHash = () => {
    const nextUrl = `${globalThis.location.pathname}${globalThis.location.search}${GALLERY_HASH}`;
    globalThis.history.pushState(null, "", nextUrl);
  };

  const handleBrowseGalleryClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }

    const target = getGalleryElement();

    if (!target) {
      return;
    }

    event.preventDefault();

    if (globalThis.location.hash !== GALLERY_HASH) {
      updateGalleryHash();
    }

    scrollToGallery();
  };

  return (
    <section className="relative px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
      <motion.div
        variants={orchestrate}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-5xl"
      >
        {/* Overline */}
        <motion.div variants={riseIn} className="mb-8 flex items-center gap-4">
          <div className="
            h-px max-w-12 flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.5)]
          " />
          <span className="text-[0.6rem] tracking-[0.6em] text-gold uppercase sm:text-[0.65rem]">
            Showcase
          </span>
          <div className="
            h-px max-w-12 flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.5)]
          " />
        </motion.div>

        {/* Large number overlay */}
        <div className="relative">
          <motion.div
            variants={scaleReveal}
            className="
              pointer-events-none absolute -top-8 -left-2 select-none
              sm:-top-14 sm:-left-4
            "
          >
            <span className="
              font-display text-[8rem] leading-none font-black text-[hsl(var(--gold)/0.04)]
              sm:text-[12rem]
              md:text-[16rem]
            ">
              <HeroStatNumber
                reducedMotion={prefersReducedMotion}
                target={totalVariants}
              />
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={riseIn}
            className="
              relative font-display text-4xl leading-[1.05] font-black tracking-tight
              sm:text-5xl
              md:text-6xl
              lg:text-7xl
            "
          >
            <span className="text-foreground">Every Card,</span>
            <br />
            <span className="text-gold">Every Variant</span>
          </motion.h1>
        </div>

        {/* Subtitle */}
        <motion.p
          variants={riseIn}
          className="mt-6 max-w-lg font-body-serif text-base/relaxed text-foreground/45 sm:text-lg"
        >
          Browse{" "}
          <span className="font-semibold text-foreground/70">
            <HeroStatNumber
              reducedMotion={prefersReducedMotion}
              target={totalCardTypes}
            />{" "}
            distinct card types
          </span>{" "}
          spread across{" "}
          <span className="font-semibold text-foreground/70">
            {categoryCount} categories
          </span>{" "}
          — all pulled live from{" "}
          <a
            href="https://anilist.co/user/Alpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold transition-colors hover:text-gold/80 hover:underline"
          >
            @Alpha49
          </a>
          {"."}
        </motion.p>

        <motion.p
          variants={riseIn}
          className="
            mt-5 max-w-3xl font-body-serif text-sm/relaxed text-foreground/40
            sm:text-base/relaxed
          "
        >
          Open a single collection when you want a cleaner comparison, or load
          the full gallery when you are in full gremlin mode and need to inspect
          every variation side by side before choosing a direction.
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
              <p className="font-display text-3xl leading-none font-black text-gold sm:text-4xl">
                <HeroStatNumber
                  reducedMotion={prefersReducedMotion}
                  target={stat.value}
                />
                {stat.suffix && (
                  <span className="text-xl text-gold/50">{stat.suffix}</span>
                )}
              </p>
              <p className="mt-1.5 text-[0.6rem] tracking-[0.2em] text-foreground/30 uppercase">
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
          <Link
            href={createHref}
            className="imperial-btn inline-flex imperial-btn-fill items-center"
          >
            <Sparkles className="mr-2 size-4" />
            Create Yours
          </Link>
          <a
            href="#card-gallery"
            onClick={handleBrowseGalleryClick}
            className="group imperial-btn inline-flex imperial-btn-ghost items-center"
          >
            Browse the Gallery
            <ArrowDown className="ml-2 size-4 transition-transform group-hover:translate-y-0.5" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
