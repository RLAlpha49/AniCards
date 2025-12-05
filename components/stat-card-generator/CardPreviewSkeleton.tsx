"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Props for CardPreviewSkeleton component.
 * @property show - Whether the skeleton should be displayed.
 * @source
 */
interface CardPreviewSkeletonProps {
  show?: boolean;
}

/**
 * Skeleton loader for card preview loading state.
 * Displays placeholder shapes that match the preview layout with smooth animations.
 * @param show - Whether to display the skeleton. Defaults to true.
 * @returns A memoized skeleton component with pulsing animation.
 * @source
 */
export function CardPreviewSkeleton({
  show = true,
}: Readonly<CardPreviewSkeletonProps>) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 p-4"
    >
      {/* Title placeholder */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-lg" />
      </div>

      {/* Image placeholder - matches typical card dimensions */}
      <div className="relative">
        {/* Outer glow effect */}
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-50 blur-xl" />

        {/* Main card skeleton */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-4 dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900">
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

          {/* Card image skeleton - typical card aspect ratio */}
          <div className="relative aspect-[1.3] bg-white dark:bg-slate-700">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>

          {/* Status indicator skeleton */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative mt-4 flex items-center gap-2"
          >
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </motion.div>
        </div>
      </div>

      {/* Info footer skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2 rounded-xl border border-blue-200/50 bg-blue-50/30 p-3 dark:border-blue-800/30 dark:bg-blue-950/20"
      >
        <div className="flex items-start gap-3">
          <Skeleton className="h-6 w-6 flex-shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
