"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DarkModeToggle from "@/components/DarkModeToggle";
import { MastheadMenu, MastheadNav } from "@/components/MastheadNav";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors",
        "border-b-2 border-[#191512]/85 bg-[#f3e9d5]/95 backdrop-blur-md dark:border-[#ece1c9]/40 dark:bg-[#16120f]/95",
      )}
    >
      {/* Subtle gradient line at the top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent to-transparent",
          "via-[#b83a24]/60 dark:via-[#d4573c]/60",
        )}
      />

      <div className="flex h-16 items-center gap-4 px-6 pl-1.5">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b83a24]"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center bg-[#b83a24] text-base leading-none text-[#f8efdc] motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 dark:bg-[#d4573c] dark:text-[#16120f]"
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
          </Link>
        </div>

        <div className="mx-4 hidden h-6 w-px bg-current opacity-15 lg:block" />

        <MastheadNav />

        <div className="ml-auto flex items-center gap-3">
          <DarkModeToggle />

          <MastheadMenu />
        </div>
      </div>
    </header>
  );
}
