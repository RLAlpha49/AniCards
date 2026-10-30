"use client";

import Link from "next/link";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/home/SectionHeading";
import homeStyles from "@/components/home/home.module.css";
import { SavedCardPlate } from "./SavedCardPlate";
import { SavedCardSetDesk } from "./SavedCardSetDesk";
import type { SavedCard } from "./types";
import styles from "./user.module.css";

type SavedCardSetProps = Readonly<{
  cards: SavedCard[];
  /** Handle the cards belong to, used in the copied About block. */
  username?: string;
  /** AniList id the cards belong to. */
  userId: string;
  /** True when the page shows only the cards chosen in the generator. */
  partial: boolean;
  /** Address of the full set. */
  fullSetHref: string;
}>;

/**
 * The saved set: bulk actions, then every card.
 *
 * The first card is mounted large, so the page opens on artwork rather than on
 * a uniform grid of thumbnails. The rest follow in a gallery. The bulk desk sits
 * above the grid because the usual job is taking the whole set, not scrolling
 * past it to reach a control.
 *
 * @param props.cards - Cards in the set, in display order.
 * @param props.username - Handle the cards belong to.
 * @param props.userId - AniList id the cards belong to.
 * @param props.partial - True when the page shows a subset of the stored set.
 * @param props.fullSetHref - Address of the full set.
 * @source
 */
export function SavedCardSet({
  cards,
  username,
  userId,
  partial,
  fullSetHref,
}: SavedCardSetProps) {
  const { ref, phase } = useRevealInView<HTMLUListElement>();
  const [cover, ...rest] = cards;

  if (!cover) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sheet}>
        <SectionHeading
          numeral="壱"
          title="The set"
          note={
            partial
              ? "The cards chosen in the generator, in saved order."
              : "Every card saved for this profile."
          }
        />

        <SavedCardSetDesk cards={cards} username={username} userId={userId} />

        <ul
          ref={ref}
          data-reveal={phase}
          className={cn(styles.grid, homeStyles.reveal, homeStyles.revealFlat)}
        >
          <li className={styles.coverItem}>
            <SavedCardPlate card={cover} index={1} featured />
          </li>

          {rest.map((card, index) => (
            <li key={`${card.rawType}-${card.variation}`}>
              <SavedCardPlate card={card} index={index + 2} />
            </li>
          ))}
        </ul>

        <p className={styles.deskNote}>
          {partial ? (
            <>
              Showing {cards.length} of the cards chosen in the generator.{" "}
              <Link href={fullSetHref} className={styles.inlineLink}>
                Open the full set
              </Link>
              .
            </>
          ) : (
            <>
              Every card here is drawn by the card API from public AniList data.{" "}
              <Link href="/examples" className={styles.inlineLink}>
                Browse every card type
              </Link>{" "}
              to see what else the generator makes.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
