"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

/**
 * Props for the inline loading spinner.
 * @property size - Visual size variant for the spinner: 'sm' | 'md' | 'lg'.
 * @property className - Optional className to adjust styling.
 * @property text - Accessible label or status text shown below the spinner.
 * @property progress - Optional progress percentage (0-100) to display as a progress ring.
 * @property showProgressLabel - Whether to show the progress percentage text.
 * @source
 */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  progress?: number;
  showProgressLabel?: boolean;
}

/**
 * A compact animated spinner with optional label and progress indicator.
 * @param props - Spinner props.
 * @returns A spinner element and optional label.
 * @source
 */
export function LoadingSpinner({
  size = "md",
  className,
  text,
  progress,
  showProgressLabel = false,
}: Readonly<LoadingSpinnerProps>) {
  const id = useId();
  const reduceMotion = useReducedMotionPreference();
  // Convert React id to a safe HTML id for SVG titles.
  const safeId = id.replaceAll(".", "-").replaceAll(":", "-");

  // Size variants for different usage contexts
  const sizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  } as const;

  const gradientId = `spinner-gradient-${safeId}`;
  const titleId = `spinner-title-${safeId}`;
  const hasProgress =
    progress !== undefined && progress >= 0 && progress <= 100;

  return (
    <output
      aria-live="polite"
      aria-busy="true"
      aria-label={text ?? "Loading"}
      className="inline-flex flex-col items-center gap-2"
    >
      <div
        className={cn(sizes[size], className, "relative drop-shadow-lg")}
        aria-hidden="true"
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 24 24"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{text ?? "Loading"}</title>

          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeOpacity="0.08"
          />

          {/* Partial arc */}
          <motion.circle
            cx="12"
            cy="12"
            r="9"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="40 120"
            initial={{ rotate: 0 }}
            animate={{ rotate: reduceMotion ? 0 : 360 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1.4, repeat: Infinity, ease: "linear" }
            }
          />
        </svg>

        {/* Progress ring overlay when progress is provided */}
        {hasProgress && (
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 24 24"
          >
            <defs>
              <linearGradient
                id={`progress-gradient-${safeId}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgb(59, 130, 246)" />
                <stop offset="100%" stopColor="rgb(168, 85, 247)" />
              </linearGradient>
            </defs>

            {/* Background track */}
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeOpacity="0.1"
            />

            {/* Progress arc */}
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke={`url(#progress-gradient-${safeId})`}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(progress * 56.5) / 100} 56.5`}
            />
          </svg>
        )}
      </div>

      {/* Progress label if both progress and text are provided */}
      {hasProgress && showProgressLabel && (
        <motion.span
          className="text-xs font-semibold text-blue-600 dark:text-blue-400"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {Math.round(progress)}%
        </motion.span>
      )}

      {text && (
        <motion.p
          className="text-sm text-gray-600 dark:text-gray-400"
          initial={false}
          animate={{ opacity: reduceMotion ? 1 : [0.75, 1, 0.75] }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity }
          }
        >
          {text}
        </motion.p>
      )}
    </output>
  );
}

interface LoadingOverlayProps {
  text?: string;
  children?: ReactNode;
}

/**
 * Full-screen loading overlay with backdrop blur.
 * @param props - Optional text shown to the user while waiting.
 * @returns A full-screen overlay with a centered spinner.
 * @source
 */
export function LoadingOverlay({
  text = "Generating your cards...",
  children,
}: Readonly<LoadingOverlayProps>) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" className="text-primary" text={text} />
        {children}
      </div>
    </div>
  );
}
