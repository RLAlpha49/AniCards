"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowRight } from "@/lib/icons";
import { cn } from "@/lib/cn";
import {
  safeTrack,
  trackButtonClick,
  trackNavigation,
} from "@/lib/analytics/google-analytics";
import { PaperHero } from "@/components/primitives/PaperHero";
import {
  HERO_FACTS,
  START_ROUTES,
  type StartRoute,
} from "@/lib/content/projects";
import styles from "./projects.module.css";

/**
 * Hero for the projects page.
 *
 * The left column says what the two tools are for. The right column is the
 * page's entry point: three situations a visitor might arrive with, each
 * pointing at the tool that handles it. Two of them jump to an entry on this
 * page; the third leaves for the generator.
 * @source
 */
export function ProjectsHero() {
  const [chosenHref, setChosenHref] = useState<string | null>(null);

  /**
   * Scrolls to an entry on this page, so the jump is animated and the URL
   * still names the entry a visitor landed on.
   *
   * @param event - Click event from the route link.
   * @param route - The route that was followed.
   * @source
   */
  const followRoute = (
    event: React.MouseEvent<HTMLAnchorElement>,
    route: StartRoute,
  ) => {
    if (route.kind === "page") return;

    event.preventDefault();
    const entryId = route.href.slice(1);
    const target = document.getElementById(entryId);
    if (!target) return;

    const reduceMotion = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    /* The jump replaces the page position, so focus follows it. Without this a
       keyboard visitor stays on the route they clicked while the screen shows
       a different record. */
    target.focus({ preventScroll: true });

    globalThis.history.replaceState(null, "", route.href);

    setChosenHref(route.href);
    safeTrack(() => trackButtonClick("project_route", entryId));
  };

  return (
    <PaperHero
      edition="Other projects"
      editionNote="Free · MIT licensed · No account to create"
      kicker="From the person who built AniCards"
      title={
        <>
          More projects for
          <br />
          <em>your AniList account.</em>
        </>
      }
      lede="AniCards draws your stats. These two tools change your list. One sorts entries into custom lists using rules you write once. The other moves a manga library over from Kenmei. Both talk to AniList through your own sign-in, and both are open source."
      facts={HERO_FACTS}
      aside={
        <nav className={styles.start} aria-label="Start from what you need">
          <p className={styles.startHead}>
            <span className={styles.startSeal} aria-hidden="true">
              案
            </span>
            <span className={styles.startTitle}>Start from what you need</span>
            <span className={styles.startRule} aria-hidden="true" />
            <span className={styles.startCount}>
              {START_ROUTES.length} routes
            </span>
          </p>

          <ol className={styles.startList}>
            {START_ROUTES.map((route) => {
              const chosen = chosenHref === route.href;
              const row = (
                <>
                  <span className={styles.startNum} aria-hidden="true">
                    {route.numeral}
                  </span>
                  <span className={styles.startBody}>
                    <span className={styles.startNeed}>{route.need}</span>
                    <span className={styles.startTool}>{route.tool}</span>
                  </span>
                  {route.kind === "page" ? (
                    <ArrowRight
                      className={cn(styles.startIcon, styles.startIconForward)}
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowDown
                      className={cn(styles.startIcon, styles.startIconDown)}
                      aria-hidden="true"
                    />
                  )}
                </>
              );

              return (
                <li key={route.href}>
                  {route.kind === "page" ? (
                    <Link
                      href={route.href}
                      className={styles.startRow}
                      onClick={() =>
                        safeTrack(() =>
                          trackNavigation("generator", "projects"),
                        )
                      }
                    >
                      {row}
                    </Link>
                  ) : (
                    <a
                      href={route.href}
                      className={cn(
                        styles.startRow,
                        chosen && styles.startRowChosen,
                      )}
                      onClick={(event) => followRoute(event, route)}
                    >
                      {row}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>

          <p className={styles.startFoot}>
            The ledger below shows what each tool reads and writes. The full
            entries follow it.
          </p>
        </nav>
      }
    />
  );
}
