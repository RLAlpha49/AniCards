"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";

/**
 * Animation variants for staggered content reveal.
 * @source
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/**
 * Hero section for the search page with animated headline and value props.
 * @returns The hero section element.
 * @source
 */
export function SearchHeroSection() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center text-center"
    >
      {/* Badge */}
      <motion.div variants={itemVariants}>
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300">
          <Search className="h-4 w-4" />
          User Discovery
        </span>
      </motion.div>

      {/* Main heading */}
      <motion.h1
        variants={itemVariants}
        className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl"
      >
        Find Any{" "}
        <span className="relative">
          <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            AniList Profile
          </span>
          <motion.span
            className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </span>
      </motion.h1>

      {/* Subheading */}
      <motion.p
        variants={itemVariants}
        className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
      >
        Search by username or ID to explore detailed anime and manga statistics
        for AniList users who already have generated cards. Generate beautiful
        stat cards for those profiles in seconds.
      </motion.p>
    </motion.div>
  );
}
