"use client";

import { useId, useMemo, useState } from "react";
import { Check, Heart, Search, X } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  FAVOURITE_CARD_TYPES,
  CARD_TYPES,
  GROUP_SUMMARIES,
  filterCardTypes,
} from "../card-options";
import type { CardSelection } from "../card-options";
import type { CardType, GroupName } from "@/components/examples/card-types";
import styles from "../generator.module.css";

type CardsStepProps = Readonly<{
  selections: Record<string, CardSelection>;
  onToggle: (cardTypeId: string) => void;
  onClearAll: () => void;
  onAddGroup: (cardTypeIds: string[]) => void;
  onVariationChange: (cardTypeId: string, variation: string) => void;
  onToggleFavourites: (cardTypeId: string) => void;
  onFocusCard: (cardTypeId: string) => void;
}>;

/**
 * Step three: the card list.
 *
 * Every card is a row, grouped the same way the examples page groups them. Rows
 * rather than thumbnails: 54 cards as tiles would be a scroll with no anchor,
 * and the preview panel already shows what the artwork looks like. A group chip
 * narrows the list to one group; the toolbar can add or clear everything.
 *
 * A selected row keeps its variation chips and its favourites toggle visible,
 * so the two follow-up choices happen in place. Hovering or focusing a row
 * points the preview at that card.
 *
 * @source
 */
export function CardsStep({
  selections,
  onToggle,
  onClearAll,
  onAddGroup,
  onVariationChange,
  onToggleFavourites,
  onFocusCard,
}: CardsStepProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupName | "all">("all");
  const searchId = useId();

  const matching = useMemo(() => filterCardTypes(CARD_TYPES, query), [query]);

  const byGroup = useMemo(() => {
    const map = new Map<GroupName, CardType[]>();
    for (const card of matching) {
      const list = map.get(card.group);
      if (list) list.push(card);
      else map.set(card.group, [card]);
    }
    return map;
  }, [matching]);

  const visibleGroups = useMemo(
    () =>
      group === "all"
        ? GROUP_SUMMARIES
        : GROUP_SUMMARIES.filter((entry) => entry.name === group),
    [group],
  );

  const selectedCount = Object.keys(selections).length;
  const allSelected = selectedCount === CARD_TYPES.length;
  const matchingIds = matching.map((card) => card.id);

  return (
    <div>
      <div className={styles.cardToolbar}>
        <div className={styles.cardSearch}>
          <Search aria-hidden="true" />
          <label htmlFor={searchId} className="sr-only">
            Search cards
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, stat, or variation"
            className={styles.cardSearchInput}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className={styles.cardClear}
              aria-label="Clear the search"
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => (allSelected ? onClearAll() : onAddGroup(matchingIds))}
          className={cn(
            styles.toolbarButton,
            allSelected && styles.toolbarButtonActive,
          )}
        >
          {allSelected ? "Unselect all" : query ? "Add matches" : "Select all"}
        </button>

        {selectedCount > 0 && !allSelected && (
          <button
            type="button"
            onClick={onClearAll}
            className={styles.toolbarButton}
          >
            Clear ({selectedCount})
          </button>
        )}
      </div>

      <div className={styles.groupStrip} role="group" aria-label="Card groups">
        <button
          type="button"
          onClick={() => setGroup("all")}
          aria-pressed={group === "all"}
          className={cn(
            styles.groupChip,
            group === "all" && styles.groupChipActive,
          )}
        >
          All
          <span className={styles.groupChipCount}>{CARD_TYPES.length}</span>
        </button>

        {GROUP_SUMMARIES.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => setGroup(entry.name)}
            aria-pressed={group === entry.name}
            className={cn(
              styles.groupChip,
              group === entry.name && styles.groupChipActive,
            )}
          >
            {entry.name}
            <span className={styles.groupChipCount}>{entry.count}</span>
          </button>
        ))}
      </div>

      {matching.length === 0 ? (
        <div className={styles.cardEmpty}>
          <h3>No card matches that</h3>
          <p>
            Nothing in the catalogue has &quot;{query.trim()}&quot; in its name,
            stat, or variation. Try a shorter word.
          </p>
          <button
            type="button"
            className={styles.toolbarButton}
            onClick={() => {
              setQuery("");
              setGroup("all");
            }}
          >
            Clear the search
          </button>
        </div>
      ) : (
        visibleGroups.map((entry) => {
          const cards = byGroup.get(entry.name);
          if (!cards || cards.length === 0) return null;
          const groupSelected = cards.filter(
            (card) => selections[card.id],
          ).length;
          const groupIds = cards.map((card) => card.id);

          return (
            <section key={entry.name} className={styles.cardGroup}>
              <div className={styles.cardGroupHead}>
                <div className={styles.cardGroupTitle}>
                  <span className={styles.cardGroupNumeral} aria-hidden="true">
                    {entry.numeral}
                  </span>
                  <h3>{entry.name}</h3>
                </div>
                <div className={styles.cardGroupActions}>
                  <span className={styles.cardGroupCount}>
                    {groupSelected} of {cards.length}
                  </span>
                  <button
                    type="button"
                    className={styles.linkAction}
                    onClick={() => onAddGroup(groupIds)}
                  >
                    Add all
                  </button>
                </div>
              </div>

              <ul className={styles.cardList}>
                {cards.map((card) => (
                  <li key={card.id}>
                    <CardRow
                      card={card}
                      selection={selections[card.id]}
                      onToggle={() => onToggle(card.id)}
                      onVariationChange={(variation) =>
                        onVariationChange(card.id, variation)
                      }
                      onToggleFavourites={() => onToggleFavourites(card.id)}
                      onFocus={() => onFocusCard(card.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

type CardRowProps = Readonly<{
  card: CardType;
  selection: CardSelection | undefined;
  onToggle: () => void;
  onVariationChange: (variation: string) => void;
  onToggleFavourites: () => void;
  onFocus: () => void;
}>;

/**
 * One catalogue row.
 *
 * The tick is the selection control; the title is a second way in for anyone
 * using a keyboard, and it also moves the preview. Follow-up controls only exist
 * once the row is selected, so an unselected list stays quiet.
 *
 * @source
 */
function CardRow({
  card,
  selection,
  onToggle,
  onVariationChange,
  onToggleFavourites,
  onFocus,
}: CardRowProps) {
  const selected = Boolean(selection);
  const supportsFavourites = FAVOURITE_CARD_TYPES.has(card.id);
  const hasChoice = card.variations.length > 1;

  return (
    <div
      className={cn(styles.cardRow, selected && styles.cardRowActive)}
      onMouseEnter={onFocus}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={selected ? `Remove ${card.title}` : `Add ${card.title}`}
        className={cn(styles.cardTick, selected && styles.cardTickOn)}
      >
        <Check aria-hidden="true" />
      </button>

      <div className={styles.cardName}>
        <p className={styles.cardTitle}>
          <card.icon aria-hidden="true" />
          {card.title}
        </p>
        <p className={styles.cardNote}>{card.description}</p>
      </div>

      <div className={styles.cardControls}>
        {selected && hasChoice && (
          <div
            className={styles.variationPicker}
            role="group"
            aria-label={`${card.title} variations`}
          >
            {card.variations.map((variation) => {
              const active = variation.variation === selection?.variation;
              return (
                <button
                  key={variation.variation}
                  type="button"
                  onClick={() => {
                    onVariationChange(variation.variation);
                    onFocus();
                  }}
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
        )}

        {selected && supportsFavourites && (
          <button
            type="button"
            onClick={() => {
              onToggleFavourites();
              onFocus();
            }}
            aria-pressed={Boolean(selection?.showFavourites)}
            className={cn(
              styles.favouriteToggle,
              selection?.showFavourites && styles.favouriteToggleOn,
            )}
          >
            <Heart aria-hidden="true" />
            Favourites
          </button>
        )}
      </div>
    </div>
  );
}
