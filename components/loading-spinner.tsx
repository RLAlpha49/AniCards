"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

/**
 * Enhanced reusable loading spinner.
 */
export function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  // Size variants for different usage contexts
  const sizes = {
    sm: "h-4 w-4", // Small - for inline loading
    md: "h-8 w-8", // Medium - default size
    lg: "h-12 w-12", // Large - for full page loads
  };

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <motion.div
        // Rotate continuously (clockwise) while also pulsing slightly
        initial={{ rotate: 0, scale: 1 }}
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className={cn(sizes[size], className, "drop-shadow-lg")}
      >
        <svg className="h-full w-full" viewBox="0 0 24 24">
          {/* Define a gradient for the animated arc */}
          <defs>
            <linearGradient
              id="spinner-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Static background circle (track) */}
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeOpacity="0.1"
          />
          {/* Animated arc rendered with a dash pattern.
              Because the dash remains static within the rotating container,
              the arc never appears to retreat or go backwards. */}
          <motion.circle
            cx="12"
            cy="12"
            r="10"
            stroke="url(#spinner-gradient)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            // Display a partial arc using a dash array.
            // (Adjust these values to achieve your desired arc length.)
            strokeDasharray="20 40"
          />
        </svg>
      </motion.div>
      {/* Optional animated loading text */}
      {text && (
        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  text?: string;
}

/**
 * Full-screen loading overlay with backdrop blur.
 */
export function LoadingOverlay({
  text = "Generating your cards...",
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" className="text-primary" />
        <motion.p
          className="text-muted-foreground"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {text}
        </motion.p>
      </div>
    </div>
  );
}
