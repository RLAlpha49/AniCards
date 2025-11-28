"use client";

import React from "react";
import { motion } from "framer-motion";
import { GridPattern } from "@/components/grid-pattern";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";

/**
 * Animation variants used across page hero sections. Exported in case we
 * want to reuse them in other components later.
 */
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export type PageShellVariant = "default" | "home" | "compact" | "none";

type PageShellProps = Readonly<{
  badge?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  heroContent?: React.ReactNode;
  heroContentClassName?: string;
  backgroundClassName?: string;
  backgroundExtras?: React.ReactNode;
  mainClassName?: string;
  variant?: PageShellVariant;
  showGrid?: boolean;
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
  backgroundClassName,
  backgroundExtras,
  mainClassName,
  showGrid = true,
  variant = "default",
  children,
}: PageShellProps) {
  const hasHero = Boolean(badge || title || subtitle || heroContent);
  const defaultOrbs = (
    <>
      <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-cyan-400/15 to-blue-400/15 blur-3xl" />
      <div className="absolute left-0 top-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/10 to-orange-500/10 blur-3xl" />
    </>
  );

  const homeOrbs = (
    <>
      <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl" />
      <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/20 to-orange-500/20 blur-3xl" />
    </>
  );

  const compactOrbs = (
    <div className="absolute -top-28 left-1/2 h-[340px] w-[340px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/10 via-purple-400/10 to-pink-400/10 blur-3xl" />
  );

  let orbsToRender: React.ReactNode | null;
  if (variant === "none") {
    orbsToRender = null;
  } else if (variant === "home") {
    orbsToRender = (
      <>
        {defaultOrbs}
        {homeOrbs}
      </>
    );
  } else if (variant === "compact") {
    orbsToRender = compactOrbs;
  } else {
    orbsToRender = defaultOrbs;
  }
  return (
    <ErrorBoundary>
      <div className={cn("relative w-full overflow-hidden", mainClassName)}>
        {/* Background effects matching home page */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0",
            backgroundClassName,
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          {orbsToRender}
          {backgroundExtras}
        </div>

        {showGrid && <GridPattern className="z-0" />}

        <div className="relative z-10 h-full">
          {/* Hero Section (render only when hero props are present) */}
          {hasHero && (
            <section className="relative h-full w-full overflow-hidden">
              <div className="container relative z-10 mx-auto px-0">
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
                    className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl"
                  >
                    {title}
                  </motion.h1>

                  {subtitle && (
                    <motion.p
                      variants={itemVariants}
                      className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
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
