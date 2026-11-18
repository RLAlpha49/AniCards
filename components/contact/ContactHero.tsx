"use client";

import { CardPreviewImage } from "@/components/primitives/CardPreviewImage";
import { PaperHero } from "@/components/primitives/PaperHero";
import styles from "./contact.module.css";

/** Figures under the hero copy, all true of this page. @source */
const FACTS = [
  { label: "Kinds of message", value: "4" },
  { label: "Account needed", value: "None" },
] as const;

/**
 * Hero for the contact page.
 *
 * Left column: who answers and what the page is for. Right column: one card
 * print with a caption, so the page shows the thing every message is about
 * before it asks for one. The print itself is decorative, so its alt text is
 * empty and the caption carries the meaning.
 * @source
 */
export function ContactHero() {
  return (
    <PaperHero
      edition="Contact"
      editionNote="Four reasons to write in"
      editionNoteDecorative
      kicker="Where to reach me"
      title={
        <>
          Tell me what the cards
          <br />
          <em>got wrong.</em>
        </>
      }
      lede="Tell me about a card that shows the wrong stat, a layout that breaks on a long genre name, or a card type the generator does not have yet. Pick what your message is about and the page names the channel that handles it, what to include, and how long it usually takes."
      facts={FACTS}
      aside={
        <figure className={styles.printFrame}>
          <div className={styles.printStack}>
            <span className={styles.tape} aria-hidden="true" />

            {/* Behind: a score strip tucked under the main print, so the
                  column reads as a stack rather than one loose card. */}
            <div className={styles.printUnder} aria-hidden="true">
              <CardPreviewImage
                cardType="animeScoreDistribution"
                variation="horizontal"
                alt=""
                className={styles.printImage}
                eager
              />
            </div>

            <div className={styles.print}>
              <CardPreviewImage
                cardType="profileOverview"
                variation="vertical"
                alt=""
                className={styles.printImage}
                eager
              />
            </div>

            <span className={styles.seal} aria-hidden="true">
              便
            </span>
          </div>

          <figcaption className={styles.printCaption}>
            <span className={styles.printCaptionLabel}>The subject</span>
            {
              "Every message on this page is about one of these: a card the generator drew from public AniList data, and whether it drew it right."
            }
          </figcaption>
        </figure>
      }
    />
  );
}
