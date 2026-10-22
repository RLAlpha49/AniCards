"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import DarkModeToggle from "@/components/DarkModeToggle";
import { MastheadMenu, MastheadNav } from "@/components/MastheadNav";
import { cn } from "@/lib/utils";
import { isPaperPage } from "@/lib/page-theme";

/**
 * Application header that anchors to the top of the viewport.
 * - Holds the brand, the masthead navigation, and the dark mode toggle.
 * - Uses a mount check to avoid server/client rendering mismatch.
 * - Adopts the paper palette on the home page and keeps the default glass
 *   treatment everywhere else.
 * @returns A fixed header element.
 * @source
 */
export default function Header() {
  // Prevent layout mismatch between server and client by deferring rendering
  // until the component mounts on the client.
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isHome = isPaperPage(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all",
        isHome
          ? "border-b-2 border-[#191512]/85 bg-[#f3e9d5]/95 backdrop-blur-md dark:border-[#ece1c9]/40 dark:bg-[#16120f]/95"
          : "border-b border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-950/80",
      )}
    >
      {/* Subtle gradient line at the top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent to-transparent",
          isHome ? "via-[#b83a24]/60 dark:via-[#d4573c]/60" : "via-blue-500/50",
        )}
      />

      <div className="flex h-16 items-center gap-4 px-6 pl-1.5">
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2.5">
            {isHome ? (
              <>
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 place-items-center bg-[#b83a24] text-base leading-none text-[#f8efdc] dark:bg-[#d4573c] dark:text-[#16120f]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  庵
                </span>
                <span
                  className="text-xl font-extrabold tracking-tight text-[#191512] dark:text-[#ece1c9]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  AniCards
                </span>
              </>
            ) : (
              <motion.span
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                AniCards
              </motion.span>
            )}
          </Link>
        </div>

        <div className="mx-4 hidden h-6 w-px bg-current opacity-15 lg:block" />

        <MastheadNav home={isHome} />

        <div className="ml-auto flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <DarkModeToggle />
          </motion.div>

          <MastheadMenu home={isHome} />
        </div>
      </div>
    </header>
  );
}
