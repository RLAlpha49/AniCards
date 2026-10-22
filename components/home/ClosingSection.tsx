"use client";

import { ArrowDown, ArrowRight } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import styles from "./home.module.css";

type ClosingSectionProps = Readonly<{
  onGetStarted: () => void;
  onSeeExamples: () => void;
}>;

/**
 * Closing call to action for the home page.
 *
 * @param props.onGetStarted - Opens the stat card generator.
 * @param props.onSeeExamples - Scrolls back to the card gallery.
 * @source
 */
export function ClosingSection({
  onGetStarted,
  onSeeExamples,
}: ClosingSectionProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.ctaSection}>
      <div className={styles.sheet}>
        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.cta, styles.reveal)}
        >
          <span className={styles.ctaSeal} aria-hidden="true">
            記
          </span>
          <h2>
            Make your <em>first card</em>
          </h2>
          <p>
            Enter your AniList username, choose a colour preset, and pick the
            card types you want. The generator walks you through it in four
            steps.
          </p>
          <div className={styles.ctaActions}>
            <button
              type="button"
              onClick={onGetStarted}
              className={styles.ctaButton}
            >
              Open the generator
              <ArrowRight className={styles.ctaButtonIcon} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onSeeExamples}
              className={styles.ctaSecondary}
            >
              View examples
              <ArrowDown
                className={styles.ctaSecondaryIcon}
                aria-hidden="true"
              />
            </button>
          </div>
          <p className={styles.ctaFine}>
            No sign-in · Public data only · SVG, PNG, and WebP
          </p>
        </div>
      </div>
    </section>
  );
}
