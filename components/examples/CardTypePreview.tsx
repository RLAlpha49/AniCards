"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ExternalLink } from "@/lib/icons";
import { CardPreviewImage } from "@/components/CardPreviewImage";
import { cn } from "@/lib/utils";
import styles from "./card-examples.module.css";
import type { CardType, CardVariation } from "./card-types";

type CardTypePreviewProps = Readonly<{
  cardType: CardType;
  /** Position within its group, used as the card's number. */
  index: number;
  onOpenGenerator: () => void;
}>;

/**
 * How long the previous variation stays on screen after the next one lands.
 *
 * Matches the fade in `card-examples.module.css`, so the old layer is removed
 * exactly as its fade-out ends.
 * @source
 */
const FADE_MS = 460;

/**
 * How long a change waits for the next card before showing it anyway.
 *
 * A variation switch normally starts its fade once the new SVG has decoded. A
 * request that stalls must not leave the old card on screen under a chip that
 * says otherwise, so the wait is capped.
 * @source
 */
const SWAP_TIMEOUT_MS = 4000;

/**
 * One card type with a live preview and a chip per variation.
 *
 * Choosing a variation fades the new card in over the old one. The old card
 * keeps painting until the new SVG has decoded, so the preview never goes
 * blank while a card is loading.
 *
 * @param props.cardType - The card type and its variations.
 * @param props.index - Position within its group.
 * @param props.onOpenGenerator - Opens the stat card generator.
 * @source
 */
export function CardTypePreview({
  cardType,
  index,
  onOpenGenerator,
}: CardTypePreviewProps) {
  /*
   * The preview renders a stack of layers, oldest first. Normally there is one.
   * On a change the outgoing layer is kept and the incoming one is added on top,
   * then the outgoing layer is dropped once the fade ends.
   *
   * Layers are keyed by variation, so the outgoing card keeps its own element
   * and its painted artwork. Remounting it would make the browser request the
   * same SVG again, which blanks the preview while that request is in flight.
   */
  const [layers, setLayers] = useState<CardVariation[]>(() => {
    const defaultIndex = cardType.variations.findIndex(
      (variation) => variation.variation === "default",
    );
    const initial = cardType.variations[defaultIndex === -1 ? 0 : defaultIndex];
    return initial ? [initial] : [];
  });

  const [nextCardReady, setNextCardReady] = useState(true);

  /* The fade belongs to a change, not to the first paint. Without this the
     whole page would animate its previews on load. */
  const [hasChanged, setHasChanged] = useState(false);

  const current = layers[layers.length - 1];

  /**
   * Shows the chosen variation and starts the fade.
   *
   * Choosing the variation already on screen does nothing.
   *
   * @param nextIndex - Index of the variation to show.
   * @source
   */
  const selectVariation = useCallback(
    (nextIndex: number) => {
      const next = cardType.variations[nextIndex];
      if (!next || next.variation === current?.variation) return;

      setLayers((existing) => [...existing.slice(-1), next]);
      setNextCardReady(false);
      setHasChanged(true);
    },
    [current?.variation, cardType.variations],
  );

  const handleNextCardReady = useCallback(() => {
    setNextCardReady(true);
  }, []);

  /* Caps the wait for artwork that never arrives. */
  useEffect(() => {
    if (nextCardReady) return;

    const timer = globalThis.setTimeout(
      () => setNextCardReady(true),
      SWAP_TIMEOUT_MS,
    );
    return () => globalThis.clearTimeout(timer);
  }, [nextCardReady]);

  /* Drops the outgoing layer once its fade-out has finished. */
  useEffect(() => {
    if (layers.length < 2 || !nextCardReady) return;

    const timer = globalThis.setTimeout(
      () => setLayers((existing) => existing.slice(-1)),
      FADE_MS,
    );
    return () => globalThis.clearTimeout(timer);
  }, [layers.length, nextCardReady]);

  return (
    <article className={styles.card}>
      <div className={styles.previewFrame}>
        {layers.map((layer, layerIndex) => {
          const isFront = layerIndex === layers.length - 1;

          return (
            <div
              key={layer.name}
              className={cn(
                styles.previewLayer,
                /* Only the incoming card animates in, and only once it lands. */
                isFront &&
                  hasChanged &&
                  nextCardReady &&
                  styles.previewLayerEntering,
                /* The outgoing card waits for the incoming one, then fades. */
                !isFront && nextCardReady && styles.previewLayerLeaving,
              )}
              style={{ zIndex: layerIndex + 1 }}
            >
              <CardPreviewImage
                cardType={layer.cardType}
                variation={layer.variation}
                alt={
                  isFront
                    ? `${cardType.title} card, ${layer.name} variation`
                    : ""
                }
                className={styles.preview}
                onSettled={isFront ? handleNextCardReady : undefined}
                eager
              />
            </div>
          );
        })}

        {layers.length === 0 && (
          <span className={styles.previewMissing}>
            No preview for this card
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.cardHead}>
          <span className={styles.cardIndex} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h4 className={styles.cardTitle}>{cardType.title}</h4>
        </div>

        <p className={styles.cardNote}>{cardType.description}</p>

        {cardType.variations.length > 0 && (
          <div
            className={styles.chips}
            role="group"
            aria-label={`${cardType.title} variations`}
          >
            {cardType.variations.map((variation, variationIndex) => (
              <button
                key={variation.name}
                type="button"
                onClick={() => selectVariation(variationIndex)}
                aria-pressed={variation.variation === current?.variation}
                className={cn(
                  styles.chip,
                  variation.variation === current?.variation &&
                    styles.chipActive,
                )}
              >
                {variation.name}
              </button>
            ))}
          </div>
        )}

        <div className={styles.foot}>
          {current && (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.svgLink}
            >
              Open SVG
              <ExternalLink className={styles.footIcon} aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={onOpenGenerator}
            className={styles.create}
          >
            Create this card
            <ArrowRight className={styles.footIcon} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
