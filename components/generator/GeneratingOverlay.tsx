"use client";

import { cn } from "@/lib/utils";
import styles from "./generator.module.css";

type GeneratingOverlayProps = Readonly<{
  /** How many cards this run will make. Quoted in the heading and edition line. */
  cardCount: number;
  /** The AniList handle being read, named in the note. */
  username: string;
  /** Retry counter reported by the submit hook, 0 on a first attempt. */
  retryAttempt: number;
  retryLimit: number;
  /** Which request is being retried, when one is. */
  retryOperation: string | null;
}>;

/**
 * The cover shown while the generator works.
 *
 * It is the page's own paper laid over the work with a fine hatch, with a
 * printed plate on top carrying the run's state: what is in flight, how many
 * cards are being made, and whether a retry is underway. The seal changes from
 * print (刷) to again (再) when a request is retried, so the two states are
 * legible without reading the copy.
 *
 * The cover ignores pointer events. A run cannot be cancelled, so blocking the
 * page would only trap the visitor behind a modal they cannot dismiss.
 *
 * @param props.cardCount - Cards this run will make.
 * @param props.username - AniList handle being read.
 * @param props.retryAttempt - Retry counter, 0 on a first attempt.
 * @param props.retryLimit - Retries allowed before the run fails.
 * @param props.retryOperation - Request being retried, if any.
 * @source
 */
export function GeneratingOverlay({
  cardCount,
  username,
  retryAttempt,
  retryLimit,
  retryOperation,
}: GeneratingOverlayProps) {
  const retrying = retryAttempt > 0;
  const cards = `${cardCount} card${cardCount === 1 ? "" : "s"}`;
  const handle = username.trim();

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.overlayStack}>
        <span
          className={cn(styles.overlaySlip, styles.overlaySlipBack)}
          aria-hidden="true"
        />
        <span
          className={cn(styles.overlaySlip, styles.overlaySlipMid)}
          aria-hidden="true"
        />

        <div className={styles.overlayPlate}>
          <p className={styles.overlayEdition}>
            <span>{retrying ? "Retry" : "Print run"}</span>
            <span className={styles.overlayRule} aria-hidden="true" />
            <span className={styles.overlayHandle}>
              {handle ? `@${handle}` : "AniList"}
            </span>
          </p>

          <h2 className={styles.overlayTitle}>
            {retrying ? (
              "Trying again"
            ) : (
              <>
                Making <em>{cards}</em>
              </>
            )}
          </h2>

          <p className={styles.overlayNote}>
            {retrying
              ? `${retryOperation ?? "The last request"} did not answer. Retrying now, ${retryAttempt} of ${retryLimit}.`
              : "Reading the public profile, and creating those cards."}
          </p>

          <div className={styles.overlayMeter} aria-hidden="true">
            <span className={styles.overlayMeterFill} />
          </div>

          <span className={styles.overlaySeal} aria-hidden="true">
            {retrying ? "再" : "刷"}
          </span>
        </div>
      </div>
    </div>
  );
}
