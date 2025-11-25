"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";

/**
 * Props for the inline loading spinner.
 * @property size - Visual size variant for the spinner: 'sm' | 'md' | 'lg'.
 * @property className - Optional className to adjust styling.
 * @property text - Accessible label or status text shown below the spinner.
 * @source
 */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

/**
 * A compact animated spinner with optional label.
 * - Uses Framer Motion for subtle animation.
 * - Provides accessible labeling and reduced-motion respect via aria attributes.
 * @param props - Spinner props.
 * @returns A spinner element and optional label.
 * @source
 */
export function LoadingSpinner({
  size = "md",
  className,
  text,
}: Readonly<LoadingSpinnerProps>) {
  const id = useId();
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

  return (
    <output
      aria-live="polite"
      aria-busy="true"
      className="inline-flex flex-col items-center gap-2"
    >
      {/* Rotating container; disabled when user prefers reduced motion */}
      <motion.div
        initial={{ rotate: 0, scale: 1 }}
        animate={{ rotate: 360, scale: [1, 1.06, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        className={cn(sizes[size], className, "drop-shadow-lg")}
        aria-hidden={text ? undefined : true}
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
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        </svg>
      </motion.div>
      {text && (
        <motion.p
          className="text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
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
    <div className="absolute inset-0 z-[1000] flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" className="text-primary" text={text} />
        {children}
      </div>
    </div>
  );
}
