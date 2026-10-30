"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Download, FileArchive } from "@/lib/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  batchConvertAndZip,
  cn,
  copyToClipboard,
  getAbsoluteUrl,
  type BatchConversionProgress,
  type ConversionFormat,
} from "@/lib/utils";
import {
  safeTrack,
  trackBatchExport,
  trackCopyAction,
} from "@/lib/utils/google-analytics";
import { cardAnilistLine, cardSvgLink } from "./saved-card-links";
import type { SavedCard } from "./types";
import styles from "./user.module.css";

const FORMATS: ReadonlyArray<{ label: string; value: ConversionFormat }> = [
  { label: "PNG", value: "png" },
  { label: "WebP", value: "webp" },
];

type SavedCardSetDeskProps = Readonly<{
  cards: SavedCard[];
  username?: string;
  /** AniList id the cards belong to, used in the copied About block. */
  userId: string;
}>;

/**
 * Bulk actions for a saved set.
 *
 * The desk offers the two things a whole set is usually for: taking every file
 * at once, and copying the lines that put the set on an AniList profile. The
 * format choice belongs to the download, so it sits beside that action rather
 * than at the top of the panel.
 *
 * @param props.cards - Cards in the set.
 * @param props.username - Handle the cards belong to.
 * @param props.userId - AniList id the cards belong to.
 * @source
 */
export function SavedCardSetDesk({
  cards,
  username,
  userId,
}: SavedCardSetDeskProps) {
  const [format, setFormat] = useState<ConversionFormat>("png");
  const [copied, setCopied] = useState<"svg" | "anilist" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<BatchConversionProgress | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  const svgLinks = useMemo(() => cards.map(cardSvgLink), [cards]);
  const anilistLines = useMemo(() => cards.map(cardAnilistLine), [cards]);

  /* The first line of the block is the same stats link the old page copied:
     a heading that opens this profile's page, so the About block and the
     cards both point somewhere useful. */
  const anilistBlock = useMemo(() => {
    const query = new URLSearchParams({ userId });
    if (username) query.set("username", username);
    const statsLink = `[<h1>Stats</h1>](${getAbsoluteUrl(`/user?${query.toString()}`)})`;
    return [statsLink, ...anilistLines].join("\n");
  }, [anilistLines, userId, username]);

  const progressPercent = progress?.total
    ? Math.min(100, (progress.current / progress.total) * 100)
    : 0;

  const handleCopy = useCallback(
    async (kind: "svg" | "anilist") => {
      const value = kind === "svg" ? svgLinks.join("\n") : anilistBlock;
      try {
        await copyToClipboard(value);
        setCopied(kind);
        setMessage(null);
        globalThis.setTimeout(() => setCopied(null), 2200);
        safeTrack(() => trackCopyAction(`all_${kind}_links`));
      } catch (error) {
        console.error("Unable to copy the card links", error);
        setMessage("The browser blocked the copy. Select the text instead.");
      }
    },
    [anilistBlock, svgLinks],
  );

  const handleExport = useCallback(async () => {
    if (cards.length === 0) return;

    setExporting(true);
    setMessage(null);
    setProgress({
      current: 0,
      total: cards.length,
      success: 0,
      failure: 0,
      cardIndex: 0,
    });

    let exported = 0;
    try {
      const summary = await batchConvertAndZip(
        cards.map((card) => ({
          type: card.type,
          svgUrl: card.svgUrl,
          rawType: card.rawType,
        })),
        format,
        setProgress,
      );
      exported = summary.exported;
      setMessage(
        `Saved ${exported} ${exported === 1 ? "card" : "cards"} as ${format.toUpperCase()}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The export did not finish. Try again.",
      );
    } finally {
      safeTrack(() => trackBatchExport(format, exported, exported > 0));
      setExporting(false);
      globalThis.setTimeout(() => setMessage(null), 5000);
    }
  }, [cards, format]);

  return (
    <div className={styles.desk}>
      <div className={styles.deskRow}>
        <div className={styles.deskHead}>
          <h3>Take the whole set</h3>
          <p>
            {cards.length} {cards.length === 1 ? "card" : "cards"} · SVG in the
            browser, PNG or WebP on download
          </p>
        </div>

        <div className={styles.deskControls}>
          <div className={styles.formats}>
            <span className={styles.formatsLabel}>Download as</span>
            <div
              className={styles.formatGroup}
              role="group"
              aria-label="Download format"
            >
              {FORMATS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  aria-pressed={format === option.value}
                  className={cn(
                    styles.format,
                    format === option.value && styles.formatActive,
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.deskActions}>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={styles.secondaryAction}>
                  <Copy aria-hidden="true" />
                  Copy all links
                </button>
              </PopoverTrigger>
              <PopoverContent
                className={styles.slip}
                align="end"
                sideOffset={6}
              >
                <div className={styles.slipHead}>
                  <span className={styles.slipSeal} aria-hidden="true">
                    写
                  </span>
                  <p className={styles.slipTitle}>All links</p>
                  <span className={styles.slipRule} aria-hidden="true" />
                  <span className={styles.slipMode}>
                    {cards.length} {cards.length === 1 ? "line" : "lines"}
                  </span>
                </div>

                <div className={styles.slipField}>
                  <div className={styles.slipFieldHead}>
                    <span className={styles.slipLabel}>SVG addresses</span>
                  </div>
                  <p className={styles.slipValue}>{svgLinks.join("\n")}</p>
                  <div className={styles.slipActions}>
                    <button
                      type="button"
                      className={styles.slipButton}
                      onClick={() => {
                        void handleCopy("svg");
                      }}
                    >
                      {copied === "svg" ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <Copy aria-hidden="true" />
                      )}
                      {copied === "svg" ? "Copied" : "Copy SVG addresses"}
                    </button>
                  </div>
                </div>

                <div className={styles.slipField}>
                  <div className={styles.slipFieldHead}>
                    <span className={styles.slipLabel}>
                      AniList About block
                    </span>
                  </div>
                  <p className={styles.slipValue}>{anilistBlock}</p>
                  <div className={styles.slipActions}>
                    <button
                      type="button"
                      className={styles.slipButton}
                      onClick={() => {
                        void handleCopy("anilist");
                      }}
                    >
                      {copied === "anilist" ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <Copy aria-hidden="true" />
                      )}
                      {copied === "anilist" ? "Copied" : "Copy About block"}
                    </button>
                  </div>
                </div>

                {message && <p className={styles.slipMessage}>{message}</p>}
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => {
                void handleExport();
              }}
              disabled={exporting}
              className={styles.primaryAction}
            >
              <FileArchive aria-hidden="true" />
              {exporting ? "Packaging" : "Download all"}
              <Download aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {exporting && progress && (
        <div>
          <div className={styles.deskProgress} aria-hidden="true">
            <div
              className={styles.deskProgressBar}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className={styles.deskNote} role="status">
            Converting {progress.current} of {progress.total}.{" "}
            {progress.success} done, {progress.failure} failed.
          </p>
        </div>
      )}

      {message && !exporting && (
        <p className={styles.deskNote} role="status">
          {message}
        </p>
      )}

      <p className={styles.deskNote}>
        Cards are cached for 24 hours. If a number looks out of date, a hard
        refresh (<kbd>Ctrl</kbd> + <kbd>F5</kbd>) fetches the current artwork.
      </p>
    </div>
  );
}
