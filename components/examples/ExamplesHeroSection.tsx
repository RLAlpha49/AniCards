"use client";

import { useId } from "react";
import { ArrowRight, ExternalLink, Search, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { PaperHero } from "@/components/primitives";
import styles from "./card-examples.module.css";
import type { GroupSummary } from "@/lib/cards/catalogue";

type ExamplesHeroSectionProps = Readonly<{
  groups: GroupSummary[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totals: { cardTypes: number; variations: number; matching: number };
}>;

/**
 * Hero for the examples page.
 *
 * Pairs the headline and search field with the page's group navigation. Each
 * group row shows how many card types it holds, and those counts follow the
 * active search.
 *
 * @param props.groups - Groups with their current match counts.
 * @param props.searchQuery - The current search term.
 * @param props.onSearchChange - Updates the search term.
 * @param props.totals - Card type and variation counts.
 * @source
 */
export function ExamplesHeroSection({
  groups,
  searchQuery,
  onSearchChange,
  totals,
}: ExamplesHeroSectionProps) {
  const searchId = useId();
  const isSearching = searchQuery.trim().length > 0;

  return (
    <PaperHero
      edition="Card examples"
      editionNote={`${totals.cardTypes} card types · ${totals.variations} variations`}
      kicker="Every card the generator makes"
      title={
        <>
          All {totals.cardTypes} card types,
          <br />
          <em>with real data.</em>
        </>
      }
      lede="Every card below is rendered by the card API from a public AniList profile. Switch a card's variations to see how each layout looks before you pick one."
      aside={
        <nav aria-label="Card groups" className={styles.groupNav}>
          <p className={styles.groupNavHead}>
            <span>Jump to a group</span>
            <span className={styles.groupNavRule} aria-hidden="true" />
            <span>6 groups</span>
          </p>

          <ol className={styles.groupNavList}>
            {groups.map((group) => {
              const empty = group.matchCount === 0;

              return (
                <li key={group.name}>
                  <a
                    href={`#${group.anchor}`}
                    className={cn(
                      styles.groupNavItem,
                      empty && styles.groupNavItemMuted,
                    )}
                    aria-disabled={empty || undefined}
                    tabIndex={empty ? -1 : undefined}
                  >
                    <span className={styles.groupNavNum} aria-hidden="true">
                      {group.numeral}
                    </span>
                    <span className={styles.groupNavName}>
                      {group.name}
                      <span className={styles.groupNavNote}>{group.note}</span>
                    </span>
                    <span className={styles.groupNavCount}>
                      {group.matchCount}
                    </span>
                    <ArrowRight
                      className={styles.groupNavIcon}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      }
    >
      <form
        role="search"
        className={styles.search}
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={searchId} className="sr-only">
          Search card types
        </label>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          id={searchId}
          type="text"
          placeholder="Search by card name, stat, or variation"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className={styles.searchInput}
          autoComplete="off"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className={styles.searchClear}
          >
            Clear
            <X className={styles.searchClearIcon} aria-hidden="true" />
          </button>
        )}
      </form>

      <output className={styles.searchStatus}>
        {isSearching
          ? `${totals.matching} of ${totals.cardTypes} card types match "${searchQuery.trim()}"`
          : `${totals.cardTypes} card types · ${totals.variations} variations`}
      </output>

      <p className={styles.source}>
        Preview data comes from{" "}
        <a
          href="https://anilist.co/user/Alpha49"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sourceLink}
        >
          @Alpha49 on AniList
          <ExternalLink className={styles.sourceLinkIcon} aria-hidden="true" />
        </a>
      </p>
    </PaperHero>
  );
}
