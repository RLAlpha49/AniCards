"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ChevronUp } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackButtonClick,
  trackNavigation,
} from "@/lib/utils/google-analytics";
import homeStyles from "@/components/home/home.module.css";
import styles from "./contact.module.css";

/**
 * Closing block for the contact page.
 *
 * Most people who reach this page are looking for something the generator
 * already does, so the last action sends them there instead of asking for
 * another message. The secondary action returns to the desk.
 * @source
 */
export function ContactClosing() {
  const router = useRouter();
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  const openGenerator = () => {
    safeTrack(() => trackButtonClick("open_generator", "contact_closing"));
    safeTrack(() => trackNavigation("generator", "contact_closing"));
    router.push("/generator");
  };

  const backToDesk = () => {
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className={styles.closing}>
      <div className={styles.sheet}>
        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.cta, homeStyles.reveal, homeStyles.revealFlat)}
        >
          <span className={styles.ctaSeal} aria-hidden="true">
            便
          </span>
          <h2>
            Try the <em>generator</em> first
          </h2>
          <p>
            Most questions about a card answer themselves once you see it
            rendered with your own stats. Enter a username, pick a palette, and
            look before you write in.
          </p>
          <div className={styles.ctaActions}>
            <button
              type="button"
              onClick={openGenerator}
              className={styles.ctaButton}
            >
              Open the generator
              <ArrowRight className={styles.ctaButtonIcon} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={backToDesk}
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
            No sign-in · Public data only · One person reads every message
          </p>
        </div>
      </div>
    </section>
  );
}
