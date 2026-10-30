"use client";

import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import homeStyles from "@/components/home/home.module.css";
import styles from "./search.module.css";
import { SearchLookupPanel } from "./SearchLookupPanel";

type SearchHeroProps = Readonly<{
  onLoadingChange: (loading: boolean) => void;
}>;

/**
 * Hero for the search page.
 *
 * Two columns on a wide screen: what the lookup is for on the left, the field
 * that does it on the right. Stacked, the panel moves directly under the intro
 * so the field is the first control on a phone.
 *
 * @param props.onLoadingChange - Reports the pending lookup to the page.
 * @source
 */
export function SearchHero({ onLoadingChange }: SearchHeroProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.hero}>
      <div className={styles.sheet}>
        <p className={styles.edition}>
          <span>Saved cards</span>
          <span className={styles.editionRule} aria-hidden="true" />
          <span>Open the set you already made</span>
        </p>

        <div className={styles.heroRule} />

        <div className={styles.heroInner}>
          <div
            ref={ref}
            data-reveal={phase}
            className={cn(
              styles.heroCopy,
              homeStyles.reveal,
              homeStyles.revealFlat,
            )}
          >
            <p className={styles.kicker}>
              <span className={styles.kickerRule} aria-hidden="true" />
              For cards you already generated
            </p>

            <h1 className={styles.title}>
              Come back to
              <br />
              <em>your cards.</em>
            </h1>

            <p className={styles.lede}>
              Every card the generator makes is saved against the AniList
              profile it came from. Enter a handle, or that profile&apos;s
              numeric ID, to open the set you already made and copy, download,
              or embed the cards. Nobody has to run the generator a second time.
            </p>
          </div>

          <SearchLookupPanel onLoadingChange={onLoadingChange} />

          <dl className={styles.meta}>
            <div>
              <dt>Accepts</dt>
              <dd>Handle or ID</dd>
            </div>
            <div>
              <dt>Opens</dt>
              <dd>The saved set</dd>
            </div>
            <div>
              <dt>Generator</dt>
              <dd>Not needed</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
