"use client";

import Link from "next/link";
import { SimpleGithubIcon } from "./SimpleIcons";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Star, GitFork, ExternalLink } from "lucide-react";

/**
 * Floating GitHub call-to-action with enhanced tooltip and interactive animations.
 * - Presents a modern glassmorphism button that links to the repository.
 * - Features an expandable tooltip with star and fork actions.
 * - Includes smooth entrance animations and hover effects.
 * @returns A positioned repository link element.
 * @source
 */
export default function GithubCorner() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.3,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      className="fixed right-4 top-20 z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="group relative">
        {/* Main Button */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Link
            href="https://github.com/RLAlpha49/Anicards"
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-slate-300 hover:shadow-xl dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:border-slate-600"
            aria-label="View project repository on GitHub"
          >
            {/* Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700 dark:to-slate-800" />

            {/* Animated ring */}
            <div className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20" />
            </div>

            <SimpleGithubIcon
              size={28}
              className="relative z-10 text-slate-600 transition-all duration-300 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white"
            />
          </Link>
        </motion.div>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-full top-0 mr-3"
            >
              <div className="relative">
                {/* Tooltip Card */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-white/95 shadow-xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/95">
                  {/* Header */}
                  <div className="border-b border-slate-200/50 bg-gradient-to-r from-slate-50 to-white px-4 py-3 dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-800/50">
                    <div className="flex items-center gap-2">
                      <SimpleGithubIcon
                        size={18}
                        className="text-slate-700 dark:text-slate-300"
                      />
                      <div>
                        <p className="whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">
                          AniCards
                        </p>
                        <p className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                          by RLAlpha49
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <p className="mb-3 max-w-[180px] text-xs text-slate-600 dark:text-slate-400">
                      Beautiful stat cards for your AniList profile
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Link
                        href="https://github.com/RLAlpha49/Anicards"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md"
                      >
                        <Star className="h-3.5 w-3.5 fill-current" />
                        Star
                      </Link>
                      <Link
                        href="https://github.com/RLAlpha49/Anicards/fork"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <GitFork className="h-3.5 w-3.5" />
                        Fork
                      </Link>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-200/50 bg-slate-50/50 px-3 py-2 dark:border-slate-700/50 dark:bg-slate-900/50">
                    <Link
                      href="https://github.com/RLAlpha49/Anicards"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View Repository
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Tooltip Arrow */}
                <div className="absolute right-0 top-[15%] h-3 w-3 -translate-y-1/2 translate-x-1.5 rotate-45 border-r border-t border-slate-200/50 bg-white/95 dark:border-slate-700/50 dark:bg-slate-800/95" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.8,
            type: "spring",
            stiffness: 500,
            damping: 20,
          }}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-md"
        >
          <Star className="h-3 w-3 fill-white text-white" />
        </motion.div>
      </div>
    </motion.div>
  );
}
