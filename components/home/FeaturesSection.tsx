"use client";

import { ArrowRight } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import styles from "./home.module.css";

/** Four capabilities, each tied to something the generator actually does. @source */
const FEATURES = [
  {
    title: "54 card types",
    body: "Anime and manga stats, genres, tags, studios, voice actors, staff, distributions, milestones, and activity summaries.",
  },
  {
    title: "55 colour presets",
    body: "Named presets cover light, dark, and gradient themes. Custom mode takes four colours of your own.",
  },
  {
    title: "SVG output",
    body: "Cards stay sharp at any size, from a README badge to a poster. Export to PNG or WebP when you need a raster file.",
  },
  {
    title: "No account needed",
    body: "AniCards reads public AniList data only. There is nothing to sign up for.",
  },
] as const;

type FeaturesSectionProps = Readonly<{
  onGetStarted: () => void;
}>;

/**
 * Capability section for the home page.
 *
 * @param props.onGetStarted - Opens the generator from the closing action.
 * @source
 */
export function FeaturesSection({ onGetStarted }: FeaturesSectionProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.craft}>
      <div className={styles.sheet}>
        <SectionHeading
          numeral="弐"
          title="What you get"
          note="Four things the generator handles for you."
        />

        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.craftGrid, styles.reveal)}
        >
          {FEATURES.map((item, index) => (
            <article key={item.title} className={styles.craftCard}>
              <span className={styles.craftNum}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.craftAction}>
          <button
            type="button"
            onClick={onGetStarted}
            className={styles.primary}
          >
            Open the generator
            <ArrowRight className={styles.primaryIcon} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
