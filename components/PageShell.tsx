"use client";

import { motion } from "framer-motion";
import React from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

/**
 * Components can extend these base values for timing or transform differences.
 */
export const baseVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/**
 * Default page-level variants that apply the PageShell timings and values.
 */
export const containerVariants = {
  ...baseVariants,
  visible: {
    ...baseVariants.visible,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

export const itemVariants = {
  hidden: { ...baseVariants.hidden, y: 20 },
  visible: {
    ...baseVariants.visible,
    y: 0,
    transition: { duration: 0.5 },
  },
};

type PageShellProps = Readonly<{
  badge?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  heroContent?: React.ReactNode;
  heroContentClassName?: string;
  mainClassName?: string;
  children?: React.ReactNode;
}>;

/**
 * Shared page wrapper used by pages that have a hero section with the common
 * background and grid visuals. Keeps the hero animation variants consistent
 * and reduces repeated JSX across pages.
 */
export default function PageShell({
  badge,
  title,
  subtitle,
  heroContent,
  heroContentClassName,
  mainClassName,
  children,
}: PageShellProps) {
  const hasHero = Boolean(badge || title || subtitle || heroContent);

  return (
    <ErrorBoundary>
      <div className={cn("relative w-full overflow-hidden", mainClassName)}>
        <div className="relative z-10 h-full">
          {hasHero && (
            <section className="relative size-full overflow-x-visible overflow-y-hidden">
              <div className="relative z-10 container mx-auto px-0">
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mx-auto flex w-full flex-col items-center text-center"
                >
                  {badge && (
                    <motion.div variants={itemVariants}>{badge}</motion.div>
                  )}

                  <motion.h1
                    variants={itemVariants}
                    className="
                      mt-8 text-4xl leading-[1.1] font-extrabold tracking-tight text-foreground
                      sm:text-5xl
                      md:text-6xl
                      lg:text-7xl
                    "
                  >
                    {title}
                  </motion.h1>

                  {subtitle && (
                    <motion.p
                      variants={itemVariants}
                      className="mt-6 max-w-2xl text-lg text-foreground/60 sm:text-xl"
                    >
                      {subtitle}
                    </motion.p>
                  )}

                  {heroContent && (
                    <motion.div
                      variants={itemVariants}
                      className={heroContentClassName}
                    >
                      {heroContent}
                    </motion.div>
                  )}
                </motion.div>
              </div>
            </section>
          )}

          {children}
        </div>
      </div>
    </ErrorBoundary>
  );
}
