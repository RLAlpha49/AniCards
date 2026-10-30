"use client";

import { ArrowDown, ArrowRight, Play } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { CardPreviewImage } from "@/components/CardPreviewImage";
import { SeigaihaDivider } from "@/components/SeigaihaDivider";
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

      <SeigaihaDivider className={styles.wave} />
    </section>
  );
}
