"use client";

import { ArrowRight, ChevronUp } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import homeStyles from "@/components/home/home.module.css";
import styles from "./card-examples.module.css";

type ExamplesCTAProps = Readonly<{
  onOpenGenerator: () => void;
  cardTypeCount: number;
}>;

/**
 * Closing block for the examples page.
 *
 * Names the card type count, then sends the visitor to the generator. The
 * secondary action returns to the top of the page.
 *
 * @param props.onOpenGenerator - Opens the stat card generator.
 * @param props.cardTypeCount - Number of card types shown on the page.
 * @source
 */
export function ExamplesCTA({
  onOpenGenerator,
  cardTypeCount,
}: ExamplesCTAProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  const scrollToTop = () => {
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className={styles.ctaSection}>
      <div className={styles.sheet}>
        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.cta, homeStyles.reveal, homeStyles.revealFlat)}
        >
          <span className={styles.ctaSeal} aria-hidden="true">
            記
          </span>
          <h2>
            Make these <em>your cards</em>
          </h2>
          <p>
            Every card on this page comes from the same generator. Enter your
            AniList username, pick a colour preset, choose your card types, and
            download the files.
          </p>
          <div className={styles.ctaActions}>
            <button
              type="button"
              onClick={onOpenGenerator}
              className={styles.ctaButton}
            >
              Create your cards
              <ArrowRight className={styles.ctaButtonIcon} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={scrollToTop}
              className={styles.ctaSecondary}
            >
              Back to the top
              <ChevronUp
                className={styles.ctaSecondaryIcon}
                aria-hidden="true"
              />
            </button>
          </div>
          <p className={styles.ctaFine}>
            No sign-in · Public data only · {cardTypeCount} card types
          </p>
        </div>
      </div>
    </section>
  );
}
