"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/home/SectionHeading";
import homeStyles from "@/components/home/home.module.css";
import styles from "./user.module.css";

const STEPS = [
  {
    title: "Copy a card's About line",
    body: "Open the copy menu on any card above and take the AniList About line. It wraps the card's address in the syntax AniList reads as an image.",
  },
  {
    title: "Open your profile editor",
    body: "On AniList, open your profile and edit the About field. The line goes anywhere in the text, on a line of its own.",
  },
  {
    title: "Paste, save, and check",
    body: "Save the profile, then reload it. AniList draws the card at 150px wide, so the numbers should still be readable.",
  },
] as const;

/**
 * Explains the one thing a visitor does with the cards besides downloading
 * them: putting one on an AniList profile.
 * @source
 */
export function SavedCardGuide() {
  const { ref, phase } = useRevealInView<HTMLOListElement>();

  const exampleLine =
    "img150(https://api.anicards.alpha49.com/card.svg?userId=…&cardType=animeStats)";

  return (
    <section className={styles.section} aria-labelledby="anilist-guide-heading">
      <div className={styles.sheet}>
        <SectionHeading
          numeral="弐"
          title="Put a card on your profile"
          note="AniList reads one line and draws the card as an image."
        />

        <div className={styles.guide}>
          <ol
            ref={ref}
            data-reveal={phase}
            className={cn(styles.steps, homeStyles.reveal)}
          >
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNum}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {index === 0 && (
                  <p className={styles.codeLine}>{exampleLine}</p>
                )}
              </li>
            ))}
          </ol>

          <div className={styles.guideFoot}>
            <p>
              AniList only draws the image on the profile it belongs to. A card
              for a different handle still loads, but it shows that
              profile&apos;s numbers.
            </p>
            <a
              href="https://anilist.co/settings"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.secondaryAction}
            >
              <ExternalLink aria-hidden="true" />
              Open AniList profile settings
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Closing action for the user page: make a different set, or look at what else
 * the generator can draw.
 * @source
 */
export function SavedCardClosing() {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.sectionLast}>
      <div className={styles.sheet}>
        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.empty, homeStyles.reveal, homeStyles.revealFlat)}
        >
          <span className={styles.emptySeal} aria-hidden="true">
            改
          </span>
          <h2>Change the cards, keep the profile</h2>
          <p>
            The generator saves over this set, so you can swap the palette, pick
            different cards, or both. Anything you want to keep, download first.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/generator" className={styles.primaryAction}>
              Open the generator
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/examples" className={styles.secondaryAction}>
              See every card type
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
