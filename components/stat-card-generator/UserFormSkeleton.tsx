"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Props for UserFormSkeleton component.
 * @property show - Whether the skeleton should be displayed.
 * @source
 */
interface UserFormSkeletonProps {
  show?: boolean;
}

/**
 * Skeleton loader for user details form loading state.
 * Displays placeholder shapes that match the form layout.
 * @param show - Whether to display the skeleton. Defaults to true.
 * @returns A skeleton component with staggered animation for form fields.
 * @source
 */
export function UserFormSkeleton({
  show = true,
}: Readonly<UserFormSkeletonProps>) {
  if (!show) return null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-50/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50"
    >
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/50">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-4"
        >
          <motion.div variants={itemVariants}>
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </motion.div>
          <motion.div variants={itemVariants} className="flex-1">
            <Skeleton className="mb-2 h-6 w-40 rounded-lg" />
            <Skeleton className="h-4 w-56 rounded" />
          </motion.div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Label */}
          <motion.div variants={itemVariants}>
            <Skeleton className="mb-3 h-5 w-24 rounded" />
          </motion.div>

          {/* Input Field */}
          <motion.div variants={itemVariants}>
            <Skeleton className="h-14 w-full rounded-xl" />
          </motion.div>

          {/* Value Props Section */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="flex items-center gap-3 rounded-lg border border-slate-200/30 bg-slate-50/50 p-3 dark:border-slate-700/30 dark:bg-slate-800/30"
              >
                <Skeleton className="h-5 w-5 flex-shrink-0 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </motion.div>
            ))}
          </motion.div>

          {/* Footer text */}
          <motion.div variants={itemVariants}>
            <Skeleton className="h-4 w-3/4 rounded" />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
