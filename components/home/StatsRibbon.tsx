"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Clock, Layers, Sparkles, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  getMotionSafeAnimation,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

const STATS = [
  { icon: Layers, value: "20+", label: "Card Types", countTo: 20, suffix: "+" },
  {
    icon: Sparkles,
    value: "∞",
    label: "Combinations",
    countTo: null,
    suffix: "",
  },
  {
    icon: Zap,
    value: "<1s",
    label: "Render Time",
    countTo: 1,
    suffix: "s",
    prefix: "<",
  },
  {
    icon: Clock,
    value: "24h",
    label: "Data Refresh",
    countTo: 24,
    suffix: "h",
  },
] as const;

function AnimatedCount({
  to,
  suffix,
  prefix,
  fallback,
  isInView,
  reducedMotion,
}: Readonly<{
  to: number | null;
  suffix: string;
  prefix?: string;
  fallback: string;
  isInView: boolean;
  reducedMotion: boolean;
}>) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const display = useTransform(rounded, (v) =>
    to === null ? fallback : `${prefix ?? ""}${v}${suffix}`,
  );

  useEffect(() => {
    if (reducedMotion || !isInView || to === null) return;
    const controls = animate(count, to, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [count, isInView, reducedMotion, to]);

  if (reducedMotion) {
    return (
      <span>{to === null ? fallback : `${prefix ?? ""}${to}${suffix}`}</span>
    );
  }

  if (to === null) {
    return (
      <motion.span
        initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
        animate={getMotionSafeAnimation(
          reducedMotion,
          isInView ? { scale: 1, opacity: 1 } : {},
        )}
        transition={
          reducedMotion
            ? NO_MOTION_TRANSITION
            : { duration: 0.6, ease: "easeOut" }
        }
      >
        {fallback}
      </motion.span>
    );
  }

  return <motion.span>{display}</motion.span>;
}

export function StatsRibbon() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const prefersReducedMotion = useReducedMotion() ?? false;
  const containerVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
  });
  const itemVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 16,
    duration: 0.5,
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      ref={ref}
      className="mx-auto max-w-5xl border-y border-gold/25 bg-gold/2 px-6 py-12 sm:px-12"
    >
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={getMotionSafeAnimation(prefersReducedMotion, {
              scale: 1.05,
              transition: { duration: 0.2 },
            })}
            className="text-center"
          >
            <motion.div
              animate={getMotionSafeAnimation(
                prefersReducedMotion,
                isInView ? { rotate: [0, -10, 10, 0] } : {},
              )}
              transition={
                prefersReducedMotion
                  ? NO_MOTION_TRANSITION
                  : { duration: 0.6, delay: 0.3 + i * 0.1 }
              }
            >
              <stat.icon className="mx-auto mb-3 size-5 text-gold/40" />
            </motion.div>
            <span className="mb-1 block font-display text-3xl text-gold sm:text-4xl">
              <AnimatedCount
                to={stat.countTo}
                suffix={stat.suffix}
                prefix={"prefix" in stat ? stat.prefix : undefined}
                fallback={stat.value}
                isInView={isInView}
                reducedMotion={prefersReducedMotion}
              />
            </span>
            <span className="font-body-serif text-xs tracking-[0.2em] text-foreground/40 uppercase">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
