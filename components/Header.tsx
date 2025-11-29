"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import DarkModeToggle from "@/components/DarkModeToggle";
import { SidebarTrigger } from "@/components/ui/Sidebar";

/**
 * Application header that anchors to the top of the viewport.
 * - Includes the main navigation link and a dark mode toggle.
 * - Uses a mount check to avoid server/client rendering mismatch.
 * - Features a modern glassmorphism design with gradient accents.
 * @returns A fixed header element.
 * @source
 */
export default function Header() {
  // Prevent layout mismatch between server and client by deferring rendering
  // until the component mounts on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all dark:border-slate-700/50 dark:bg-slate-950/80">
      {/* Subtle gradient line at the top */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

      <div className="flex h-16 items-center gap-4 px-6 pl-1.5">
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <SidebarTrigger className="h-9 w-9 rounded-xl border border-slate-200/50 bg-white/50 text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white" />
          </motion.div>

          <Link href="/" className="group flex items-center gap-2.5">
            <motion.span
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              AniCards
            </motion.span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <DarkModeToggle />
          </motion.div>
        </div>
      </div>
    </header>
  );
}
