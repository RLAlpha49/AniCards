"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Download } from "@/lib/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { copyToClipboard, svgToPng, type ConversionFormat } from "@/lib/utils";
import {
  safeTrack,
  trackCardDownload,
  trackCopyAction,
} from "@/lib/utils/google-analytics";
import { cardAnilistLine, cardSvgLink } from "./saved-card-links";
import type { SavedCard } from "./types";
import styles from "./user.module.css";

const DOWNLOAD_FORMATS: ReadonlyArray<{
  label: string;
  value: ConversionFormat;
}> = [
  { label: "PNG", value: "png" },
  { label: "WebP", value: "webp" },
];

type SavedCardActionsProps = Readonly<{
  card: SavedCard;
}>;

/**
 * Actions for one saved card: download it as a raster file, or copy the link
 * that makes it show up on an AniList profile.
 *
 * Both are per card rather than batch-only, because the usual job is taking one
 * card, not all of them.
 *
 * @param props.card - The card the actions apply to.
 * @source
 */
export function SavedCardActions({ card }: SavedCardActionsProps) {
  const [copied, setCopied] = useState<"svg" | "anilist" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svgLink = cardSvgLink(card);
  const anilistLine = cardAnilistLine(card);

  const handleCopy = useCallback(
    async (value: string, kind: "svg" | "anilist") => {
      try {
        await copyToClipboard(value);
        setCopied(kind);
        setError(null);
        globalThis.setTimeout(() => setCopied(null), 2000);
        safeTrack(() => trackCopyAction(`${kind}_${card.rawType}`));
      } catch (copyError) {
        console.error("Unable to copy the card link", copyError);
        setError("The browser blocked the copy. Open the link instead.");
      }
    },
    [card.rawType],
  );

  const handleDownload = useCallback(
    async (format: ConversionFormat) => {
      setDownloading(true);
      setError(null);
      try {
        const dataUrl = await svgToPng(card.svgUrl, format);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${card.rawType}-${card.variation.toLowerCase().replaceAll(/\s+/g, "-")}.${format}`;
        link.click();
        safeTrack(() => trackCardDownload(`${card.rawType}_${format}`));
      } catch (downloadError) {
        console.error("Unable to convert the card", downloadError);
        setError("That card could not be converted. Try again in a moment.");
      } finally {
        setDownloading(false);
      }
    },
    [card.rawType, card.svgUrl, card.variation],
  );

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={styles.plateAction}
            aria-label={`Copy a link to the ${card.type} card`}
          >
            <Copy aria-hidden="true" />
            Copy link
          </button>
        </PopoverTrigger>
        <PopoverContent className={styles.slip} align="start" sideOffset={6}>
          <div className={styles.slipHead}>
            <span className={styles.slipSeal} aria-hidden="true">
              写
            </span>
            <p className={styles.slipTitle}>{card.type}</p>
            <span className={styles.slipRule} aria-hidden="true" />
            <span className={styles.slipMode}>{card.variation}</span>
          </div>

          <div className={styles.slipField}>
            <div className={styles.slipFieldHead}>
              <span className={styles.slipLabel}>Direct SVG address</span>
            </div>
            <p className={styles.slipValue}>{svgLink}</p>
            <div className={styles.slipActions}>
              <button
                type="button"
                className={styles.slipButton}
                onClick={() => {
                  void handleCopy(svgLink, "svg");
                }}
              >
                {copied === "svg" ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copied === "svg" ? "Copied" : "Copy SVG address"}
              </button>
            </div>
            <p className={styles.slipNote}>
              Paste this anywhere that takes an image address.
            </p>
          </div>

          <div className={styles.slipField}>
            <div className={styles.slipFieldHead}>
              <span className={styles.slipLabel}>AniList About line</span>
            </div>
            <p className={styles.slipValue}>{anilistLine}</p>
            <div className={styles.slipActions}>
              <button
                type="button"
                className={styles.slipButton}
                onClick={() => {
                  void handleCopy(anilistLine, "anilist");
                }}
              >
                {copied === "anilist" ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copied === "anilist" ? "Copied" : "Copy About line"}
              </button>
            </div>
            <p className={styles.slipNote}>
              AniList draws this line as the card image in a profile.
            </p>
          </div>

          {error && <p className={styles.slipMessage}>{error}</p>}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={styles.plateAction}
            disabled={downloading}
            aria-label={`Download the ${card.type} card`}
          >
            <Download aria-hidden="true" />
            {downloading ? "Converting" : "Download"}
          </button>
        </PopoverTrigger>
        <PopoverContent className={styles.slip} align="start" sideOffset={6}>
          <div className={styles.slipHead}>
            <span className={styles.slipSeal} aria-hidden="true">
              下
            </span>
            <p className={styles.slipTitle}>Download</p>
            <span className={styles.slipRule} aria-hidden="true" />
            <span className={styles.slipMode}>{card.type}</span>
          </div>

          <p className={styles.slipNote}>
            The card is drawn as SVG and converted to a raster file at its own
            size.
          </p>

          <div className={styles.slipActions}>
            {DOWNLOAD_FORMATS.map((format) => (
              <button
                key={format.value}
                type="button"
                className={`${styles.slipButton} ${styles.slipButtonAlt}`}
                disabled={downloading}
                onClick={() => {
                  void handleDownload(format.value);
                }}
              >
                <Download aria-hidden="true" />
                Download {format.label}
              </button>
            ))}
          </div>

          {error && <p className={styles.slipMessage}>{error}</p>}
        </PopoverContent>
      </Popover>
    </>
  );
}
