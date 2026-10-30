"use client";

import { useMemo } from "react";
import { CardPreviewImage } from "@/components/CardPreviewImage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Eye } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  buildCardPreviewUrl,
  findCardType,
  variationLabel,
  type CardSelection,
  type PreviewOptions,
} from "./card-options";
import styles from "./generator.module.css";

type PreviewPanelProps = Readonly<{
  /** Card shown in the preview, or an empty string when nothing is selected. */
  cardTypeId: string;
  selection: CardSelection | undefined;
  /** The draft settings the preview renders with. */
  options: PreviewOptions;
  selectedCount: number;
  /** Told which variation the visitor picked from the preview itself. */
  onVariationChange: (cardTypeId: string, variation: string) => void;
}>;

/**
 * The live preview.
 *
 * Shows the card currently being judged: the last one added, or the one the
 * visitor last touched. Colours come from the live palette, so a preset or a
 * hex edit is visible on the actual artwork before the cards are generated.
 * variation chips under the frame let a shape change happen here rather than
 * back in the list, which is where a visitor is looking when they decide the
 * layout is wrong.
 *
 * @source
 */
export function PreviewPanel({
  cardTypeId,
  selection,
  options,
  selectedCount,
  onVariationChange,
}: PreviewPanelProps) {
  const card = cardTypeId ? findCardType(cardTypeId) : undefined;

  const src = useMemo(() => {
    if (!card || !selection) return null;
    return buildCardPreviewUrl({
      cardTypeId: card.id,
      variation: selection.variation,
      showFavourites: selection.showFavourites,
      options,
    });
  }, [card, selection, options]);

  const previewRequest = useMemo(() => {
    if (!card || !selection || !src) return null;
    return {
      cardTypeId: card.id,
      variation: selection.variation,
      src,
    };
  }, [card, selection, src]);
  const settledRequest = useDebouncedValue(previewRequest);
  const displayedRequest =
    settledRequest &&
    card &&
    selection &&
    settledRequest.cardTypeId === card.id &&
    settledRequest.variation === selection.variation
      ? settledRequest
      : null;

  return (
    <aside className={styles.preview} aria-label="Preview of the current card">
      <div className={styles.previewHead}>
        <p className={styles.previewTitle}>
          <Eye aria-hidden="true" />
          Preview
        </p>
        <p className={styles.previewCount}>{selectedCount} chosen</p>
      </div>

      <div className={styles.previewFrame}>
        {displayedRequest ? (
          <div className={styles.previewLayer}>
            <CardPreviewImage
              key={displayedRequest.src}
              cardType={displayedRequest.cardTypeId}
              variation={displayedRequest.variation}
              src={displayedRequest.src}
              alt={`${card?.title ?? "Card"} card, ${variationLabel(
                displayedRequest.variation,
              )} variation`}
              className={styles.previewImage}
              eager
            />
          </div>
        ) : (
          <div className={styles.previewMissing}>
            <span className={styles.previewMissingSeal} aria-hidden="true">
              空
            </span>
            <p>
              {card && selection
                ? "Updating preview…"
                : "Choose a card and the preview appears here."}
            </p>
          </div>
        )}
      </div>

      {card && selection ? (
        <>
          <div className={styles.previewCaption}>
            <strong>{card.title}</strong>
            <span>{variationLabel(selection.variation)}</span>
          </div>

          <div
            className={styles.previewVariations}
            role="group"
            aria-label={`${card.title} variations`}
          >
            {card.variations.map((variation) => {
              const active = variation.variation === selection.variation;
              return (
                <button
                  key={variation.variation}
                  type="button"
                  onClick={() =>
                    onVariationChange(card.id, variation.variation)
                  }
                  aria-pressed={active}
                  className={cn(
                    styles.variationChip,
                    active && styles.variationChipActive,
                  )}
                >
                  {variation.name}
                </button>
              );
            })}
          </div>

          <p className={styles.previewHint}>
            Rendered from a public AniList profile with the colours you picked.
            Your card will show your own numbers.
          </p>
        </>
      ) : (
        <p className={styles.previewHint}>
          The preview renders from a public AniList profile, so you can judge a
          layout before committing to it.
        </p>
      )}
    </aside>
  );
}
