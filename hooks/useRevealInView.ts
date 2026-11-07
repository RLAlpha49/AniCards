"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Reveal phase for a scroll entrance.
 *
 * `idle` has no styles, so server-rendered markup stays visible when JavaScript
 * never runs. `hidden` holds the element back until it scrolls in, and `shown`
 * plays the entrance.
 * @source
 */
export type RevealPhase = "idle" | "hidden" | "shown";

type RevealInViewOptions = Readonly<{
  rootMargin?: string;
  threshold?: number;
}>;

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Reveals an element the first time it scrolls into view.
 *
 * Elements already on screen, or above it after a restored scroll position,
 * go straight to `shown`, so their entrance plays immediately and nothing is
 * stranded invisible. Elements below the fold turn `hidden` before paint, then
 * move to `shown` when they intersect or when the viewport reaches them. The
 * observer disconnects after the first sighting.
 *
 * A reduced-motion preference or a missing IntersectionObserver returns
 * `idle`, which leaves the element unstyled.
 *
 * @param options.rootMargin - Observer margin, defaulting to a short lead-in.
 * @param options.threshold - Visible fraction required to reveal.
 * @returns The element ref and its reveal phase.
 * @source
 */
export function useRevealInView<T extends HTMLElement>({
  rootMargin = "0px 0px -6% 0px",
  threshold = 0.08,
}: RevealInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [phase, setPhase] = useState<RevealPhase>("idle");

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof IntersectionObserver === "undefined" ||
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setPhase("idle");
      return;
    }

    const rect = node.getBoundingClientRect();
    const laidOut = rect.width > 0 || rect.height > 0;

    /* An element without a layout box has nothing to hide, so let it show.
       This also covers the first frame before stylesheet-driven layout. */
    if (!laidOut) {
      setPhase("shown");
      return;
    }

    /* A restored scroll position can land mid-page. Anything at or above the
       fold is either visible now or already passed, so it shows at once. */
    const aboveOrOnScreen = rect.top < globalThis.innerHeight;
    setPhase(aboveOrOnScreen ? "shown" : "hidden");
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || phase !== "hidden") return;

    /* The observer only reports a change in intersection. A scroll that jumps
       past the element within a single frame never produces an intersecting
       entry, so a scroll listener covers that case and keeps the element
       from being stranded at `opacity: 0`. */
    const revealIfReached = () => {
      if (node.getBoundingClientRect().top < globalThis.innerHeight) {
        setPhase("shown");
      }
    };

    const observer = new IntersectionObserver(
      (entries, instance) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setPhase("shown");
            instance.disconnect();
            return;
          }
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(node);
    globalThis.addEventListener("scroll", revealIfReached, { passive: true });
    // The viewport may have moved between the layout effect and this effect.
    revealIfReached();

    return () => {
      observer.disconnect();
      globalThis.removeEventListener("scroll", revealIfReached);
    };
  }, [phase, rootMargin, threshold]);

  return { ref, phase } as const;
}
