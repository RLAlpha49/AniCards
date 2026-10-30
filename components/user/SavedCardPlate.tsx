"use client";

import { CardPreviewImage } from "@/components/CardPreviewImage";
import { SavedCardActions } from "./SavedCardActions";
import type { SavedCard } from "./types";
import styles from "./user.module.css";

type SavedCardPlateProps = Readonly<{
  card: SavedCard;
  /** Position in the set, used as the printed number. */
  index: number;
  /** Renders the card large, as the page's opening artwork. */
  featured?: boolean;
}>;

/**
 * One saved card, framed on paper with its number, name, and layout.
 *
 * The preview goes through `CardPreviewImage`, which recognises the API's
 * error graphic, so a card that cannot be drawn says so instead of showing a
 * black box. The image keeps its own ratio inside a fixed-height frame, so a
 * portrait and a landscape card still line up across the grid.
 *
 * The featured variant is the page's opening card: artwork on the left, its
 * settings and actions on the right, so the set begins with one card at a
 * readable size instead of a uniform grid of thumbnails.
 *
 * @param props.card - The card to show.
 * @param props.index - Position in the set.
 * @param props.featured - Renders the large opening card.
 * @source
 */
export function SavedCardPlate({
  card,
  index,
  featured = false,
}: SavedCardPlateProps) {
  const preview = (
    <CardPreviewImage
      src={card.svgUrl}
      cardType={card.rawType}
      alt={`${card.type} card, ${card.variation} layout`}
      className={featured ? styles.coverImage : styles.plateImage}
      style={{ borderRadius: `${Math.max(0, card.borderRadius - 1)}px` }}
      eager={featured}
    />
  );

  const number = String(index).padStart(2, "0");

  if (featured) {
    return (
      <figure className={styles.cover}>
        <div className={styles.coverFrame}>{preview}</div>
        <figcaption className={styles.coverCartouche}>
          <span className={styles.coverIndex} aria-hidden="true">
            {number}
          </span>
          <div className={styles.coverTitleWrap}>
            <h3 className={styles.coverTitle}>{card.type}</h3>
            <p className={styles.coverNote}>{card.variation} layout</p>
          </div>

          <dl className={styles.coverFacts}>
            <div>
              <dt>Palette</dt>
              <dd>{card.preset}</dd>
            </div>
            <div>
              <dt>Corners</dt>
              <dd>{card.borderRadius}px</dd>
            </div>
          </dl>

          <div className={styles.plateActions}>
            <SavedCardActions card={card} />
          </div>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={styles.plate}>
      <div className={styles.plateFrame}>{preview}</div>
      <figcaption className={styles.cartouche}>
        <span className={styles.plateIndex} aria-hidden="true">
          {number}
        </span>
        <span className={styles.plateTitle}>{card.type}</span>
        <span className={styles.plateNote}>{card.variation}</span>

        <div className={styles.plateActions}>
          <SavedCardActions card={card} />
        </div>
      </figcaption>
    </figure>
  );
}
