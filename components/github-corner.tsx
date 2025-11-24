"use client";

import Link from "next/link";
import { SimpleGithubIcon } from "./icons/simple-icons";
import { motion } from "framer-motion";

export default function GithubCorner() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="fixed right-4 top-20 z-50"
    >
      <div className="group relative">
        <Link
          href="https://github.com/RLAlpha49/Anicards"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white/30 hover:bg-white/20 hover:shadow-xl dark:border-gray-700/30 dark:bg-gray-800/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30"
          aria-label="View project repository on GitHub"
        >
          <SimpleGithubIcon
            size={28}
            className="text-gray-600 transition-all duration-300 group-hover:text-gray-800 dark:text-gray-300 dark:group-hover:text-white"
          />
        </Link>

        {/* Enhanced Tooltip */}
        <div className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 translate-x-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100">
          <div className="relative">
            <div className="rounded-xl border border-white/20 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md dark:border-gray-700/30 dark:bg-gray-800/90">
              <p className="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                View Repository
              </p>
              <p className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                Star the project! ⭐
              </p>
            </div>
            {/* Tooltip Arrow */}
            <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rotate-45 border-r border-t border-white/20 bg-white/90 dark:border-gray-700/30 dark:bg-gray-800/90"></div>
          </div>
        </div>

        {/* Pulse Animation Ring (hover-only) */}
        <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 transition-opacity duration-300 group-hover:animate-pulse group-hover:opacity-100"></div>
      </div>
    </motion.div>
  );
}
