"use client";

import { useMemo } from "react";
import { CardPreviewImage } from "@/components/CardPreviewImage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { buildCardPreviewUrl, type PreviewOptions } from "./card-options";
import styles from "./generator.module.css";

/** One side of a demo: a card rendered with a specific setting. @source */
type DemoSide = Readonly<{
  label: string;
  cardTypeId: string;
  variation: string;
  /** The setting under test, applied on top of the preview settings. */
  apply: Partial<PreviewOptions>;
  /** Per-card favourites flag, which the preview options do not carry. */
  showFavourites?: boolean;
}>;

type OptionDemoProps = Readonly<{
  side: DemoSide;
  options: PreviewOptions;
  /** Whether this is the "off" or "on" sample. */
  tone: "off" | "on";
}>;

/**
 * One thumbnail in a setting demo.
 *
 * Renders a real card through the same URL builder the preview uses, so the
 * example is the card the visitor will actually get rather than an illustration
 * of it.
 *
 * @source
 */
export function OptionDemo({ side, options, tone }: OptionDemoProps) {
  const src = useMemo(
    () =>
      buildCardPreviewUrl({
        cardTypeId: side.cardTypeId,
        variation: side.variation,
        showFavourites: Boolean(side.showFavourites),
        options: { ...options, ...side.apply },
      }),
    [side, options],
  );
  const settledSrc = useDebouncedValue(src);

  return (
    <figure className={cn(styles.demo, tone === "on" && styles.demoOn)}>
      <div className={styles.demoFrame}>
        <CardPreviewImage
          key={settledSrc}
          cardType={side.cardTypeId}
          variation={side.variation}
          src={settledSrc}
          alt=""
          className={styles.demoImage}
        />
      </div>
      <figcaption className={styles.demoLabel}>{side.label}</figcaption>
    </figure>
  );
}

type OptionDemoPairProps = Readonly<{
  /** Sample that shows the setting switched off. */
  off: DemoSide;
  /** Sample that shows the setting switched on. */
  on: DemoSide;
  options: PreviewOptions;
}>;

/**
 * A pair of thumbnails showing one setting off and on.
 *
 * Two cards beat a description: the visitor can see the difference before
 * deciding, and hover to compare without changing their own selection.
 *
 * @source
 */
export function OptionDemoPair({ off, on, options }: OptionDemoPairProps) {
  return (
    <div className={styles.demoPair}>
      <OptionDemo side={off} options={options} tone="off" />
      <OptionDemo side={on} options={options} tone="on" />
    </div>
  );
}
