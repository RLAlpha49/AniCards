"use client";

import Link from "next/link";
import { ArrowRight, ChevronUp } from "@/lib/icons";
import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackButtonClick,
  trackExternalLinkClick,
  trackNavigation,
} from "@/lib/utils/google-analytics";
import homeStyles from "@/components/home/home.module.css";
import styles from "./projects.module.css";

/**
 * Closing block for the projects page.
 *
 * Offers the two things a visitor can still want at this point: the generator,
 * which is what this site is for, and the GitHub profile, for everything else.
 * The secondary action returns to the top of the page.
 * @source
 */
export function ProjectsClosing() {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  const scrollToTop = () => {
    safeTrack(() => trackButtonClick("projects_back_to_top"));
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className={styles.closing}>
      <div className={styles.sheet}>
        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.closingBox, homeStyles.reveal)}
        >
          <span className={styles.closingSeal} aria-hidden="true">
            庵
          </span>
          <h2>
            Your stats are what <em>this site</em> makes.
          </h2>
          <p>
            The two projects above change your AniList lists. AniCards reads the
            same account and turns it into cards. Start there, or browse the
            rest of the code on GitHub.
          </p>

          <div className={styles.closingActions}>
            <Link
              href="/generator"
              className={styles.closingPrimary}
              onClick={() =>
                safeTrack(() =>
                  trackNavigation("generator", "projects_closing"),
                )
              }
            >
              Open the generator
              <ArrowRight
                className={styles.closingPrimaryIcon}
                aria-hidden="true"
              />
            </Link>

            <a
              href="https://github.com/RLAlpha49"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.closingSecondary}
              onClick={() =>
                safeTrack(() =>
                  trackExternalLinkClick("github_profile", "projects_closing"),
                )
              }
            >
              <span aria-hidden="true" className={styles.closingIcon}>
                <SimpleGithubIcon size={16} />
              </span>
              Visit my GitHub
            </a>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className={styles.closingTop}
          >
            Back to the top
            <ChevronUp className={styles.closingTopIcon} aria-hidden="true" />
          </button>

          <p className={styles.closingFine}>
            Free · MIT licensed · No account on this site
          </p>
        </div>
      </div>
    </section>
  );
}
