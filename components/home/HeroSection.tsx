"use client";

import { useId } from "react";
import { ArrowDown, ArrowRight, Play } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { CardPreviewImage } from "@/components/CardPreviewImage";
import styles from "./home.module.css";

type HeroSectionProps = Readonly<{
  onGetStarted: () => void;
  onSeeExamples: () => void;
}>;

/** Figures quoted in the hero, matching the generator catalogue. @source */
const FACTS = [
  { label: "Card types", value: "54" },
  { label: "Colour presets", value: "55" },
  { label: "Sign-in", value: "Not needed" },
];

/**
 * Seigaiha (青海波) scallop geometry for the hero divider.
 *
 * Three rows of concentric arcs hang from a hairline rule, each row offset by
 * half a tile so the fans interlock. Arcs are generated once at module load and
 * repeated through an SVG pattern, so the divider is a single small tile at any
 * viewport width.
 * @source
 */
const SEIGAIHA = (() => {
  const radius = 34;
  const rowGap = radius / 2;
  const tileWidth = radius * 2;
  const rows = 3;
  const rings = [1, 0.72, 0.44, 0.18];
  const paths: string[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = row * rowGap;
    const offset = (row % 2) * radius;

    for (let x = offset - tileWidth; x <= tileWidth + offset; x += tileWidth) {
      for (const ring of rings) {
        const r = Number((radius * ring).toFixed(2));
        paths.push(`M${x - r} ${y}a${r} ${r} 0 0 0 ${2 * r} 0`);
      }
    }
  }

  // The tile must be tall enough for the lowest row's outermost arc, otherwise
  // the pattern clips it and the fans lose their bottom edge.
  const tileHeight = (rows - 1) * rowGap + radius;

  return { paths, tileWidth, tileHeight };
})();

/**
 * Hero for the home page.
 *
 * Pairs the headline and actions with a collage of four cards: one square to
 * the frame, one pinned above it, one fanned off the right edge, and one
 * tucked underneath. The lower edge is closed by a seigaiha divider.
 *
 * @param props.onGetStarted - Opens the stat card generator.
 * @param props.onSeeExamples - Scrolls to the card gallery.
 * @source
 */
export function HeroSection({ onGetStarted, onSeeExamples }: HeroSectionProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();
  const dividerId = useId();

  return (
    <section className={styles.hero}>
      <div className={styles.sheet}>
        <p className={styles.edition}>
          <span>AniList stat card generator</span>
          <span className={styles.editionRule} aria-hidden="true" />
          <span>Free · No sign-in</span>
        </p>

        <div className={styles.heroRule} />

        <div className={styles.heroInner}>
          <div
            ref={ref}
            data-reveal={phase}
            className={cn(styles.heroCopy, styles.reveal)}
          >
            <p className={styles.kicker}>
              <span className={styles.kickerRule} aria-hidden="true" />
              Built from public AniList data
            </p>

            <h1 className={styles.title}>
              Your AniList stats,
              <br />
              <em>as cards.</em>
            </h1>

            <p className={styles.lede}>
              AniCards turns a public AniList profile into shareable stat cards.
              Choose a card type, adjust the colours, and download the result.
              No account needed.
            </p>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={onGetStarted}
                className={styles.primary}
              >
                <Play className={styles.primaryIcon} aria-hidden="true" />
                Create your card
                <ArrowRight className={styles.primaryIcon} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onSeeExamples}
                className={styles.secondary}
              >
                View examples
                <ArrowDown
                  className={styles.secondaryIcon}
                  aria-hidden="true"
                />
              </button>
            </div>

            <dl className={styles.meta}>
              {FACTS.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <figure className={styles.printFrame}>
            <span className={styles.tape} aria-hidden="true" />

            <div className={styles.printStack}>
              {/* Under: wide manga print slipping out below the bottom-left
                  corner, behind the front print. */}
              <div className={styles.slipUnder} aria-hidden="true">
                <CardPreviewImage
                  cardType="mangaStats"
                  variation="default"
                  alt=""
                  className={styles.slipImage}
                  eager
                />
              </div>

              {/* Front: the main print, always fully readable. */}
              <div className={styles.printInner}>
                <CardPreviewImage
                  cardType="animeStats"
                  variation="vertical"
                  alt="Anime statistics card in a vertical layout"
                  className={styles.printImage}
                  eager
                />
              </div>

              {/* Above: score strip laid across the top edge, overlapping the
                  other prints rather than hiding behind them. */}
              <div className={styles.slipTop} aria-hidden="true">
                <CardPreviewImage
                  cardType="animeScoreDistribution"
                  variation="horizontal"
                  alt=""
                  className={styles.slipImage}
                  eager
                />
              </div>

              {/* Side: genre pie fanned off the right edge, in front. */}
              <div className={styles.slipSide} aria-hidden="true">
                <CardPreviewImage
                  cardType="animeGenres"
                  variation="pie"
                  alt=""
                  className={styles.slipImage}
                  eager
                />
              </div>
            </div>

            <span className={styles.seal} aria-hidden="true">
              記
            </span>
          </figure>
        </div>
      </div>

      <div className={styles.wave} aria-hidden="true">
        <svg focusable="false">
          <defs>
            <pattern
              id={`${dividerId}-tile`}
              width={SEIGAIHA.tileWidth}
              height={SEIGAIHA.tileHeight}
              patternUnits="userSpaceOnUse"
            >
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              >
                {SEIGAIHA.paths.map((d, index) => (
                  <path key={index} d={d} />
                ))}
              </g>
            </pattern>

            {/* The band dissolves into the paper towards the gallery, so it
                reads as a printed rule rather than a hard edge. */}
            <linearGradient
              id={`${dividerId}-fade`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0.06" stopColor="#fff" />
              <stop offset="0.92" stopColor="#000" />
            </linearGradient>
            <mask id={`${dividerId}-mask`}>
              <rect
                width="100%"
                height="100%"
                fill={`url(#${dividerId}-fade)`}
              />
            </mask>
          </defs>

          <rect
            width="100%"
            height="100%"
            fill={`url(#${dividerId}-tile)`}
            opacity="0.8"
            mask={`url(#${dividerId}-mask)`}
          />
          <rect width="100%" height="1" fill="currentColor" opacity="0.55" />
        </svg>
      </div>
    </section>
  );
}
