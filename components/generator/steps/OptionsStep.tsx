"use client";

import { useId } from "react";
import {
  Heart,
  LayoutGrid,
  Percent,
  ShieldCheck,
  type HugeIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  FAVOURITE_CARD_TYPES,
  findCardType,
  variationLabel,
} from "../card-options";
import type { CardSelection, PreviewOptions } from "../card-options";
import { OptionDemoPair } from "../OptionDemo";
import styles from "../generator.module.css";

type OptionsStepProps = Readonly<{
  selections: Record<string, CardSelection>;
  selectedIds: string[];
  username: string;
  animeStatusColors: boolean;
  mangaStatusColors: boolean;
  piePercentages: boolean;
  gridColumns: number;
  gridRows: number;
  needsGridSize: boolean;
  /** The draft settings, used to render the option demos. */
  options: PreviewOptions;
  onToggleAnimeStatusColors: () => void;
  onToggleMangaStatusColors: () => void;
  onTogglePiePercentages: () => void;
  onGridSizeChange: (columns: number, rows: number) => void;
  /** Turns favourites on or off for every selected card that supports them. */
  onSetAllFavourites: (value: boolean) => void;
}>;

/** Which card demonstrates the status colour setting. @source */
const ANIME_STATUS_DEMO = {
  cardTypeId: "animeStatusDistribution",
  variation: "pie",
};
const MANGA_STATUS_DEMO = {
  cardTypeId: "mangaStatusDistribution",
  variation: "pie",
};

/** Which card demonstrates the pie percentage setting. @source */
const PIE_DEMO = { cardTypeId: "animeGenres", variation: "pie" };

/** Which card demonstrates the favourites setting. @source */
const FAVOURITES_DEMO = {
  cardTypeId: "animeVoiceActors",
  variation: "default",
};

/**
 * Which card demonstrates the grid size setting. The grid is the only card
 * that reads the columns and rows, so the demo has to be that card.
 * @source
 */
const GRID_DEMO = { cardTypeId: "favoritesGrid", variation: "anime" };

/**
 * Step four: the chart details, then a last look at the card list.
 *
 * Each switch carries a pair of real thumbnails, one with the setting off and
 * one with it on, rendered in the visitor's own palette. They fade in on hover
 * or keyboard focus, so the step reads as a short list until someone asks
 * what a setting does.
 *
 * Favourites is a per-card option in the API, so it is offered as one bulk
 * action over the eligible cards rather than a single global flag that most
 * cards would ignore.
 *
 * @source
 */
export function OptionsStep({
  selections,
  selectedIds,
  username,
  animeStatusColors,
  mangaStatusColors,
  piePercentages,
  gridColumns,
  gridRows,
  needsGridSize,
  options,
  onToggleAnimeStatusColors,
  onToggleMangaStatusColors,
  onTogglePiePercentages,
  onGridSizeChange,
  onSetAllFavourites,
}: OptionsStepProps) {
  const columnsId = useId();
  const rowsId = useId();
  const favouritesHeadId = useId();
  const trimmed = username.trim();

  const eligibleFavourites = selectedIds.filter((id) =>
    FAVOURITE_CARD_TYPES.has(id),
  );
  const favouritesOn = eligibleFavourites.filter(
    (id) => selections[id]?.showFavourites,
  ).length;

  const blockers: string[] = [];
  if (!trimmed) blockers.push("Enter an AniList username.");
  if (selectedIds.length === 0) blockers.push("Choose at least one card.");

  return (
    <div>
      <ul className={styles.optionList}>
        <OptionRow
          icon={ShieldCheck}
          label="Anime status colours"
          note="Fixed colours for watching, completed, dropped, and the rest on the anime status chart."
          on={animeStatusColors}
          onToggle={onToggleAnimeStatusColors}
          toggleLabel="Use fixed anime status colours"
          demo={
            <OptionDemoPair
              options={options}
              off={{
                ...ANIME_STATUS_DEMO,
                label: "Off",
                apply: { animeStatusColors: false },
              }}
              on={{
                ...ANIME_STATUS_DEMO,
                label: "On",
                apply: { animeStatusColors: true },
              }}
            />
          }
        />

        <OptionRow
          icon={ShieldCheck}
          label="Manga status colours"
          note="Fixed colours for reading, completed, dropped, and the rest on the manga status chart."
          on={mangaStatusColors}
          onToggle={onToggleMangaStatusColors}
          toggleLabel="Use fixed manga status colours"
          demo={
            <OptionDemoPair
              options={options}
              off={{
                ...MANGA_STATUS_DEMO,
                label: "Off",
                apply: { mangaStatusColors: false },
              }}
              on={{
                ...MANGA_STATUS_DEMO,
                label: "On",
                apply: { mangaStatusColors: true },
              }}
            />
          }
        />

        <OptionRow
          icon={Percent}
          label="Pie percentages"
          note="Adds a percentage to each slice on pie and donut charts."
          on={piePercentages}
          onToggle={onTogglePiePercentages}
          toggleLabel="Show percentages on pie charts"
          demo={
            <OptionDemoPair
              options={options}
              off={{
                ...PIE_DEMO,
                label: "Off",
                apply: { piePercentages: false },
              }}
              on={{
                ...PIE_DEMO,
                label: "On",
                apply: { piePercentages: true },
              }}
            />
          }
        />

        <li className={styles.optionItem}>
          <div
            className={cn(
              styles.optionRow,
              needsGridSize && styles.optionRowOn,
            )}
          >
            <div className={styles.optionText}>
              <p className={styles.optionLabel}>
                <LayoutGrid aria-hidden="true" />
                Favourites grid size
              </p>
              <p className={styles.optionNote}>
                {needsGridSize
                  ? "Used by the Favourites Grid card you selected."
                  : "Only applies when the Favourites Grid card is selected."}
              </p>

              <div className={styles.optionDemoWrap}>
                {/* A fixed coarse-versus-dense pair, not the current value
                    against the next one: at five columns there is no next one,
                    and the point is the difference, not the number. */}
                <OptionDemoPair
                  options={options}
                  off={{
                    ...GRID_DEMO,
                    label: "2 × 2 cells",
                    apply: { gridColumns: 2, gridRows: 2 },
                  }}
                  on={{
                    ...GRID_DEMO,
                    label: "5 × 5 cells",
                    apply: { gridColumns: 5, gridRows: 5 },
                  }}
                />
              </div>
            </div>

            <div className={styles.gridControl}>
              <label htmlFor={columnsId}>Cols</label>
              <input
                id={columnsId}
                type="number"
                min={1}
                max={5}
                value={gridColumns}
                onChange={(event) =>
                  onGridSizeChange(Number(event.target.value), gridRows)
                }
                aria-label="Favourites grid columns"
              />
              <label htmlFor={rowsId}>Rows</label>
              <input
                id={rowsId}
                type="number"
                min={1}
                max={5}
                value={gridRows}
                onChange={(event) =>
                  onGridSizeChange(gridColumns, Number(event.target.value))
                }
                aria-label="Favourites grid rows"
              />
            </div>
          </div>
        </li>
      </ul>

      <section
        className={styles.favouritesBlock}
        aria-labelledby={favouritesHeadId}
      >
        <div className={styles.blockHead}>
          <h3 id={favouritesHeadId}>
            <Heart aria-hidden="true" />
            Show favourites
          </h3>
          <p>
            {eligibleFavourites.length > 0
              ? `${favouritesOn} of ${eligibleFavourites.length} selected cards`
              : "Add a favourites card to use this"}
          </p>
        </div>

        <div className={styles.favouritesBody}>
          <div className={styles.favouritesCopy}>
            <p className={styles.optionNote}>
              Four cards can mark which names you favourited: voice actors,
              studios, anime staff, and manga staff. The mark is a heart beside
              the name, and the API sets it per card.
            </p>

            <div className={styles.favouritesActions}>
              <button
                type="button"
                className={cn(
                  styles.toolbarButton,
                  eligibleFavourites.length > 0 &&
                    favouritesOn === eligibleFavourites.length &&
                    styles.toolbarButtonActive,
                )}
                onClick={() => onSetAllFavourites(true)}
                disabled={eligibleFavourites.length === 0}
              >
                Show on all
              </button>
              <button
                type="button"
                className={styles.toolbarButton}
                onClick={() => onSetAllFavourites(false)}
                disabled={eligibleFavourites.length === 0}
              >
                Hide on all
              </button>
            </div>

            {eligibleFavourites.length === 0 && (
              <p className={styles.favouritesEmpty}>
                None of the four cards that support favourites is selected yet.
                They are listed under Anime Deep Dive and Manga Deep Dive.
              </p>
            )}
          </div>

          <div className={styles.favouritesDemo}>
            <OptionDemoPair
              options={options}
              off={{
                ...FAVOURITES_DEMO,
                label: "No hearts",
                apply: {},
                showFavourites: false,
              }}
              on={{
                ...FAVOURITES_DEMO,
                label: "Hearts",
                apply: {},
                showFavourites: true,
              }}
            />
          </div>
        </div>
      </section>

      <section className={styles.review} aria-live="polite">
        <div className={styles.reviewHead}>
          <h3>Your cards</h3>
          <span>
            {selectedIds.length} card{selectedIds.length === 1 ? "" : "s"}
            {favouritesOn > 0 ? ` · ${favouritesOn} with hearts` : ""}
          </span>
        </div>

        {selectedIds.length > 0 ? (
          <ul className={styles.reviewList}>
            {selectedIds.map((id, index) => (
              <ReviewCard
                key={id}
                index={index}
                cardTypeId={id}
                selection={selections[id]}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.previewHint}>
            Nothing chosen yet. Pick cards in step three and they list here.
          </p>
        )}

        {blockers.length > 0 && (
          <div className={styles.reviewBlockers}>
            <strong>Before generating</strong>
            <ul>
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

type OptionRowProps = Readonly<{
  icon: HugeIcon;
  label: string;
  note: string;
  on: boolean;
  onToggle: () => void;
  toggleLabel: string;
  demo: React.ReactNode;
}>;

/**
 * One switch row with its hover demo.
 *
 * The demo is absolutely positioned, so showing it does not push the list
 * around. Hover and keyboard focus both open it, and the row keeps a focus ring
 * on the switch so the demo is reachable without a pointer.
 *
 * @source
 */
function OptionRow({
  icon: Icon,
  label,
  note,
  on,
  onToggle,
  toggleLabel,
  demo,
}: OptionRowProps) {
  return (
    <li className={styles.optionItem}>
      <div className={cn(styles.optionRow, on && styles.optionRowOn)}>
        <div className={styles.optionText}>
          <p className={styles.optionLabel}>
            <Icon aria-hidden="true" />
            {label}
          </p>
          <p className={styles.optionNote}>{note}</p>

          <div className={styles.optionDemoWrap}>{demo}</div>
        </div>

        <input
          type="checkbox"
          className={styles.frameSwitchInput}
          checked={on}
          onChange={onToggle}
          aria-label={toggleLabel}
        />
      </div>
    </li>
  );
}

type ReviewCardProps = Readonly<{
  index: number;
  cardTypeId: string;
  selection: CardSelection;
}>;

/**
 * One card in the selection review.
 *
 * Reads as a packing list: a numbered line naming the card, its variation, and
 * whether hearts will be on it. The preview already shows artwork, so repeating a
 * thumbnail here would crowd the list without adding information.
 *
 * @source
 */
function ReviewCard({ index, cardTypeId, selection }: ReviewCardProps) {
  const card = findCardType(cardTypeId);
  if (!card) return null;

  const hasVariations = card.variations.length > 1;
  const supportsFavourites = FAVOURITE_CARD_TYPES.has(cardTypeId);

  return (
    <li className={styles.reviewCard}>
      <span className={styles.reviewIndex} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>

      <span className={styles.reviewBody}>
        <span className={styles.reviewTitle}>{card.title}</span>
        <span className={styles.reviewMeta}>
          {hasVariations && <span>{variationLabel(selection.variation)}</span>}
          {supportsFavourites && (
            <span
              className={cn(
                styles.reviewFavourite,
                selection.showFavourites && styles.reviewFavouriteOn,
              )}
            >
              <Heart aria-hidden="true" />
              {selection.showFavourites ? "Hearts on" : "No hearts"}
            </span>
          )}
        </span>
      </span>

      <card.icon className={styles.reviewIcon} aria-hidden="true" />
    </li>
  );
}
