"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Props for LivePreviewSkeleton component.
 * @property show - Whether the skeleton should be displayed.
 * @source
 */
interface LivePreviewSkeletonProps {
  show?: boolean;
}

/**
 * Skeleton loader for live preview loading state.
 * Displays a placeholder that matches the preview card layout.
 * @param show - Whether to display the skeleton. Defaults to true.
 * @returns A skeleton component with smooth animation.
 * @source
 */
export function LivePreviewSkeleton({
  show = true,
}: Readonly<LivePreviewSkeletonProps>) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center"
    >
      {/* Preview Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative"
      >
        {/* Glow effect */}
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-50 blur-xl" />

        {/* Preview frame */}
        <div className="dark:via-slate-850 relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-lg shadow-slate-200/50 transition-all duration-300 dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900 dark:shadow-slate-900/50">
          {/* Checkerboard pattern for transparency indication */}
          <div
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
            style={{
              backgroundImage: `
              linear-gradient(45deg, #000 25%, transparent 25%),
              linear-gradient(-45deg, #000 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #000 75%),
              linear-gradient(-45deg, transparent 75%, #000 75%)
            `,
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          />

          {/* SVG Content Skeleton */}
          <div className="relative aspect-video w-full">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </motion.div>

      {/* Status indicator skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 flex items-center gap-2"
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-3 w-3 rounded" />
        </div>
      </motion.div>
    </motion.div>
  );
}
