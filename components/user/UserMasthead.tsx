"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink, RefreshCw } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn, copyToClipboard, getAbsoluteUrl } from "@/lib/utils";
import {
  safeTrack,
  trackCopyAction,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";
import homeStyles from "@/components/home/home.module.css";
import styles from "./user.module.css";

type UserMastheadProps = Readonly<{
  /** Handle the cards belong to, when the record has one. */
  username?: string;
  /** AniList numeric id, always present once a record is read. */
  userId: string;
  /** How many cards are stored for the profile. */
  cardCount: number;
  /** When the stats behind the cards last changed. */
  dataUpdatedAt?: string;
}>;

/**
 * Reads a stored timestamp as a short date plus a line explaining it.
 *
 * `dataUpdatedAt` moves only when a refresh changes a number a card draws, so
 * the date answers "how current is this artwork", not "when was this saved".
 *
 * @param value - ISO timestamp from the user record.
 * @returns A date to show and the line under it.
 * @source
 */
function readStamp(value?: string): { date: string; detail: string } {
  if (!value) {
    return { date: "Not recorded", detail: "Stamped on the next refresh" };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "Not recorded", detail: "Stamped on the next refresh" };
  }

  return {
    date: parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    detail: "Last time the numbers moved",
  };
}

/**
 * Masthead for the user page.
 *
 * Names the profile the cards belong to, then states what the set holds in a
 * receipt panel: the handle and id, the card count, and the date the stats
 * last moved. The receipt also carries the ways out of the page, so a visitor
 * who only wanted the link does not have to scroll to find it.
 *
 * @param props.username - Handle the cards belong to.
 * @param props.userId - AniList numeric id.
 * @param props.cardCount - Number of cards in the set.
 * @param props.dataUpdatedAt - When the stats last changed.
 * @source
 */
export function UserMasthead({
  username,
  userId,
  cardCount,
  dataUpdatedAt,
}: UserMastheadProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();
  const [copied, setCopied] = useState(false);
  const stamp = readStamp(dataUpdatedAt);

  const handleCopyPage = useCallback(async () => {
    const url = getAbsoluteUrl(`/user?userId=${encodeURIComponent(userId)}`);
    try {
      await copyToClipboard(url);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 2000);
      safeTrack(() => trackCopyAction("user_page_link"));
    } catch (error) {
      console.error("Unable to copy the page link", error);
    }
  }, [userId]);

  const profileLabel = username ? `@${username}` : `#${userId}`;
  const cardNoun = cardCount === 1 ? "card" : "cards";

  return (
    <section className={styles.masthead}>
      <div className={styles.sheet}>
        <p className={styles.edition}>
          <span>Saved cards</span>
          <span className={styles.editionRule} aria-hidden="true" />
          <span>
            {cardCount} {cardNoun} · {profileLabel}
          </span>
        </p>

        <div className={styles.mastheadRule} />

        <div className={styles.mastheadInner}>
          <div
            ref={ref}
            data-reveal={phase}
            className={cn(styles.heroCopy, homeStyles.reveal)}
          >
            <p className={styles.kicker}>
              <span className={styles.kickerRule} aria-hidden="true" />
              Made from public AniList data
            </p>

            <h1 className={styles.title}>
              {username ? `${username}'s stat cards,` : "This profile's cards,"}
              <br />
              <em>ready to take.</em>
            </h1>

            <p className={styles.lede}>
              Every card the generator made for {profileLabel} is saved against
              that AniList profile. Download the files, or copy a line and paste
              it into the profile&apos;s About section.
            </p>

            <p className={styles.ledeNote}>
              Cards are cached for 24 hours. A change on AniList can take up to
              a day to show up here.
            </p>
          </div>

          <div className={styles.receipt}>
            <div className={styles.receiptHead}>
              <span className={styles.receiptSeal} aria-hidden="true">
                札
              </span>
              <p className={styles.receiptTitle}>This set</p>
              <span className={styles.receiptRule} aria-hidden="true" />
              <span className={styles.receiptMode} title={profileLabel}>
                {profileLabel}
              </span>
            </div>

            <dl className={styles.receiptFacts}>
              <div className={styles.receiptFact}>
                <dt>Profile</dt>
                <dd>
                  {username ?? "Unnamed"}
                  <small>AniList ID {userId}</small>
                </dd>
              </div>

              <div className={styles.receiptFact}>
                <dt>Cards</dt>
                <dd>
                  {cardCount}
                  <small>
                    {cardCount === 1
                      ? "one card in this set"
                      : `${cardCount} cards in this set`}
                  </small>
                </dd>
              </div>

              <div className={styles.receiptFact}>
                <dt>Stats changed</dt>
                <dd>
                  {stamp.date}
                  <small>{stamp.detail}</small>
                </dd>
              </div>
            </dl>

            <div className={styles.receiptActions}>
              <button
                type="button"
                onClick={() => {
                  void handleCopyPage();
                }}
                className={cn(
                  styles.receiptAction,
                  copied && styles.receiptActionDone,
                )}
              >
                {copied ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copied ? "Link copied" : "Copy page link"}
              </button>

              {username && (
                <a
                  href={`https://anilist.co/user/${encodeURIComponent(username)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    safeTrack(() =>
                      trackExternalLinkClick("anilist", "user_page"),
                    )
                  }
                  className={styles.receiptAction}
                >
                  <ExternalLink aria-hidden="true" />
                  Open on AniList
                </a>
              )}

              <Link href="/generator" className={styles.receiptAction}>
                <RefreshCw aria-hidden="true" />
                Generate a new set
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>

            <p className={styles.ledeNote}>
              Generating again replaces this set, so download anything you want
              to keep first.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
