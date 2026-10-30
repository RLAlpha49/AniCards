"use client";

import Link from "next/link";
import { SimpleGithubIcon } from "./SimpleIcons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { ExternalLink, GitFork, Star } from "@/lib/icons";

/** Repository the corner links to. @source */
const REPO_URL = "https://github.com/RLAlpha49/Anicards";

/** Fork action for the repository. @source */
const FORK_URL = `${REPO_URL}/fork`;

/** Gap kept between the seal and the bottom edge of the viewport. @source */
const CORNER_GAP = 20;

/**
 * Floating repository call to action.
 *
 * The button is a vermillion seal block with an ink offset shadow, matching the
 * paper theme's primary action and stamp marks. Hovering or focusing it expands
 * a printed plate card with the repository title and star, fork, and source
 * actions. The card closes when focus leaves the group, so keyboard users can
 * still reach every action.
 * @returns A positioned repository link element.
 * @source
 */
export default function GithubCorner() {
  const [isOpen, setIsOpen] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(CORNER_GAP);
  const reduceMotion = useReducedMotion();
  const cornerRef = useRef<HTMLDivElement>(null);

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  };

  /**
   * Keeps the seal parked above the footer instead of letting it ride over or
   * past it. While the footer is off screen the offset stays at the normal
   * viewport gap; once the footer top rises into view the seal gains exactly
   * enough offset to sit above it with `CORNER_GAP` to spare, so it holds still
   * until the footer reaches it and then stops on the footer's edge.
   * @source
   */
  useEffect(() => {
    const corner = cornerRef.current;
    if (!corner) return;

    let frame = 0;

    const syncOffset = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) return;

      const footerTop = footer.getBoundingClientRect().top;
      const clearance = window.innerHeight - footerTop + CORNER_GAP;
      // A footer taller than the viewport cannot be cleared without pushing the
      // seal under the fixed header, so stop it below the header in that case.
      const header = document.querySelector("header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const maxOffset =
        window.innerHeight - corner.offsetHeight - headerBottom - CORNER_GAP;
      const next = Math.round(
        Math.min(
          Math.max(CORNER_GAP, clearance),
          Math.max(CORNER_GAP, maxOffset),
        ),
      );
      setBottomOffset(next);
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncOffset);
    };

    syncOffset();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    // Content above the footer can reflow without a scroll (late images,
    // fonts), so watch the document box as well as the footer.
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleSync);
    observer?.observe(document.body);
    const footer = document.querySelector("footer");
    if (footer) observer?.observe(footer);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      observer?.disconnect();
    };
  }, []);

  return (
    <motion.div
      ref={cornerRef}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 0.8, 0.3, 1] }}
      /* Below the header and the modal layer, so a dialog always covers the
         corner. The bottom offset is synced above so the seal stops above the
         footer rather than sliding over or under it. `style` overrides the
         `bottom-5` fallback once the effect has measured the footer. */
      className="fixed right-5 bottom-5 z-40"
      style={{ bottom: bottomOffset }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={closeWhenFocusLeaves}
    >
      <div className="relative">
        {/* Seal block */}
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View the AniCards repository on GitHub"
          className="flex h-14 w-14 items-center justify-center border-2 border-[#191512] bg-[#b83a24] text-[#f8efdc] shadow-[4px_4px_0_#191512] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#a83320] hover:shadow-[2px_2px_0_#191512] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b83a24] dark:border-[#ece1c9]/60 dark:bg-[#d4573c] dark:text-[#16120f] dark:shadow-[4px_4px_0_rgba(0,0,0,0.85)] dark:hover:bg-[#c24c33] dark:hover:shadow-[2px_2px_0_rgba(0,0,0,0.85)] dark:focus-visible:outline-[#d4573c]"
        >
          <SimpleGithubIcon size={26} />
        </Link>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 0.8, 0.3, 1] }}
              /* Beside the seal on wide screens, above it on phones where the
                 column is too narrow to hold the card to the left. The right
                 padding bridges the gap so the pointer can cross into the
                 card without closing it. */
              className="absolute right-full bottom-0 w-[min(16.25rem,calc(100vw-7rem))] pr-3 max-sm:right-0 max-sm:bottom-full max-sm:mb-3 max-sm:w-[min(16.25rem,calc(100vw-2.5rem))] max-sm:pr-0"
            >
              <div className="relative border border-[#191512]/70 bg-[#fbf4e5] shadow-[6px_6px_0_rgba(25,21,18,0.18)] dark:border-[#ece1c9]/45 dark:bg-[#221c17] dark:shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
                {/* Seal pressed over the top-right corner */}
                <span
                  aria-hidden="true"
                  className="absolute -top-2.5 -right-2.5 grid h-7 w-7 place-items-center bg-[#b83a24] font-[family-name:var(--font-display)] text-sm leading-none text-[#f8efdc] dark:bg-[#d4573c] dark:text-[#16120f]"
                >
                  源
                </span>

                <div className="px-4 pt-3.5 pb-3">
                  <p className="text-[0.55rem] tracking-[0.3em] text-[#b83a24] uppercase dark:text-[#d4573c]">
                    Repository
                  </p>
                  <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg leading-none font-semibold text-[#191512] dark:text-[#ece1c9]">
                    AniCards
                  </p>
                  <p className="mt-1 text-[0.7rem] text-[#4d443a] dark:text-[#b6a88f]">
                    by RLAlpha49
                  </p>
                  <p className="mt-2.5 border-t border-[#191512]/20 pt-2.5 text-[0.72rem] leading-relaxed text-[#4d443a] dark:border-[#ece1c9]/20 dark:text-[#b6a88f]">
                    Beautiful stat cards for your AniList profile. Read the
                    source, star it, or fork it.
                  </p>
                </div>

                <div className="flex gap-1.5 px-4 pb-3">
                  <Link
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 border border-[#b83a24] bg-[#b83a24] px-2 py-1.5 text-[0.58rem] tracking-[0.18em] text-[#fbf3e2] uppercase transition-colors hover:border-[#191512] hover:bg-[#191512] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191512] dark:border-[#d4573c] dark:bg-[#d4573c] dark:text-[#16120f] dark:hover:border-[#ece1c9] dark:hover:bg-[#ece1c9] dark:focus-visible:outline-[#ece1c9]"
                  >
                    <Star className="h-3 w-3" aria-hidden="true" />
                    Star
                  </Link>
                  <Link
                    href={FORK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 border border-[#191512]/45 px-2 py-1.5 text-[0.58rem] tracking-[0.18em] text-[#191512] uppercase transition-colors hover:border-[#191512] hover:bg-[#191512]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191512] dark:border-[#ece1c9]/45 dark:text-[#ece1c9] dark:hover:border-[#ece1c9] dark:hover:bg-[#ece1c9]/10 dark:focus-visible:outline-[#ece1c9]"
                  >
                    <GitFork className="h-3 w-3" aria-hidden="true" />
                    Fork
                  </Link>
                </div>

                <Link
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border-t border-[#191512]/25 px-4 py-2 text-[0.58rem] tracking-[0.22em] text-[#191512] uppercase transition-colors hover:text-[#b83a24] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#b83a24] dark:border-[#ece1c9]/20 dark:text-[#ece1c9] dark:hover:text-[#d4573c] dark:focus-visible:outline-[#d4573c]"
                >
                  View repository
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>

                {/* Pointer into the seal block: the right edge when the card
                    sits beside the seal, the bottom edge when it stacks above
                    it on phones. A 45deg clockwise turn sends the top-right
                    corner right and the bottom-right corner down, so the
                    stacked variant swaps the top border for the bottom one to
                    keep the right and bottom edges. */}
                <span
                  aria-hidden="true"
                  className="absolute right-0 bottom-6 h-3 w-3 translate-x-1/2 rotate-45 border-t border-r border-[#191512]/70 bg-[#fbf4e5] max-sm:right-6 max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-1/2 max-sm:border-t-0 max-sm:border-b dark:border-[#ece1c9]/45 dark:bg-[#221c17]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
