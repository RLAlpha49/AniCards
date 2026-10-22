"use client";

import { useCallback, useMemo, useState } from "react";
import { StatCardGenerator } from "@/components/StatCardGenerator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaperSurface } from "@/components/PaperSurface";
import { SeigaihaDivider } from "@/components/SeigaihaDivider";
import { usePageSEO } from "@/hooks/usePageSEO";
import {
  GROUPS,
  GROUP_NOTES,
  GROUP_NUMERALS,
  buildCardTypes,
  groupAnchor,
} from "@/components/examples/card-types";
import type { GroupSummary } from "@/components/examples/card-types";
import { ExamplesHeroSection } from "@/components/examples/ExamplesHeroSection";
import { GroupSection } from "@/components/examples/GroupSection";
import { ExamplesCTA } from "@/components/examples/ExamplesCTA";
import { X } from "@/lib/icons";
import homeStyles from "@/components/home/home.module.css";
import styles from "@/components/examples/card-examples.module.css";

/**
 * Renders the card examples page: every card type the generator supports,
 * grouped the same way the generator groups them, with live previews.
 *
 * Search filters the card types in place. The group navigation in the hero
 * follows the same query, so its counts always describe what is on the page.
 * @source
 */
export default function ExamplesPage() {
  usePageSEO("examples");

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const cardTypes = useMemo(() => buildCardTypes(), []);

  const handleOpenGenerator = useCallback(() => {
    setIsGeneratorOpen(true);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const matching = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cardTypes;

    return cardTypes.filter(
      (cardType) =>
        cardType.title.toLowerCase().includes(query) ||
        cardType.description.toLowerCase().includes(query) ||
        cardType.group.toLowerCase().includes(query) ||
        cardType.variations.some((variation) =>
          variation.name.toLowerCase().includes(query),
        ),
    );
  }, [cardTypes, searchQuery]);

  const totals = useMemo(
    () => ({
      cardTypes: cardTypes.length,
      variations: cardTypes.reduce(
        (total, cardType) => total + cardType.variations.length,
        0,
      ),
      matching: matching.length,
    }),
    [cardTypes, matching],
  );

  const groups = useMemo<GroupSummary[]>(
    () =>
      GROUPS.map((group, index) => ({
        name: group,
        numeral: GROUP_NUMERALS[index],
        note: GROUP_NOTES[group],
        anchor: groupAnchor(group),
        matchCount: matching.filter((cardType) => cardType.group === group)
          .length,
      })),
    [matching],
  );

  return (
    <ErrorBoundary
      resetKeys={[
        isGeneratorOpen ? "generator_open" : "generator_closed",
        searchQuery,
      ]}
      onReset={() => {
        setIsGeneratorOpen(false);
        setSearchQuery("");
      }}
    >
      <PaperSurface>
        <ExamplesHeroSection
          groups={groups}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          totals={totals}
        />

        <SeigaihaDivider className={homeStyles.wave} />

        <div className={styles.groups}>
          <div className={styles.sheet}>
            {matching.length > 0 ? (
              GROUPS.map((group, index) => (
                <GroupSection
                  key={group}
                  group={group}
                  numeral={GROUP_NUMERALS[index]}
                  note={GROUP_NOTES[group]}
                  cardTypes={matching.filter(
                    (cardType) => cardType.group === group,
                  )}
                  onOpenGenerator={handleOpenGenerator}
                />
              ))
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptySeal} aria-hidden="true">
                  空
                </span>
                <h2>No card matches that search</h2>
                <p>
                  No card type has &quot;{searchQuery.trim()}&quot; in its name,
                  stat, or variation. Try a shorter word, or clear the search to
                  see every card.
                </p>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className={styles.emptyClear}
                >
                  Clear the search
                  <X aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        <ExamplesCTA
          onOpenGenerator={handleOpenGenerator}
          cardTypeCount={totals.cardTypes}
        />

        <StatCardGenerator
          isOpen={isGeneratorOpen}
          onOpenChange={(open) => setIsGeneratorOpen(open)}
        />
      </PaperSurface>
    </ErrorBoundary>
  );
}
