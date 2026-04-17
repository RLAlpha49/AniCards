"use client";

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

const HERO_REVEAL_CLASS =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500";

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
                <div className="mx-auto flex w-full flex-col items-center text-center">
                  {badge && <div className={HERO_REVEAL_CLASS}>{badge}</div>}

                  <h1
                    className={cn(
                      HERO_REVEAL_CLASS,
                      `
                        mt-8 text-4xl leading-[1.1] font-extrabold tracking-tight text-foreground
                        motion-safe:delay-75
                        sm:text-5xl
                        md:text-6xl
                        lg:text-7xl
                      `,
                    )}
                  >
                    {title}
                  </h1>

                  {subtitle && (
                    <p
                      className={cn(
                        HERO_REVEAL_CLASS,
                        "mt-6 max-w-2xl text-lg text-foreground/60 motion-safe:delay-150 sm:text-xl",
                      )}
                    >
                      {subtitle}
                    </p>
                  )}

                  {heroContent && (
                    <div
                      className={cn(
                        HERO_REVEAL_CLASS,
                        "motion-safe:delay-200",
                        heroContentClassName,
                      )}
                    >
                      {heroContent}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {children}
        </div>
      </div>
    </ErrorBoundary>
  );
}
