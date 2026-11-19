import type { HugeIcon } from "@/lib/icons";
import {
  Activity,
  BarChart2,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Heart,
  LayoutGrid,
  Mic,
  PieChart,
  TrendingUp,
  Users,
} from "@/lib/icons";
import {
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
  VARIATION_LABEL_MAP,
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import type { CardUrlParams } from "@/lib/card-groups";
import type { CardGroupName, CardId, VariationDef } from "@/lib/cards/registry";
import { CARD_GROUP_NAMES, CARD_REGISTRY } from "@/lib/cards/registry";
import type { StoredCardConfig } from "@/lib/types/records";

/**
 * The six groups the generator sorts card types into, in display order.
 * @source
 */
export const GROUPS: readonly CardGroupName[] = CARD_GROUP_NAMES;

/** A group name from {@link GROUPS}. @source */
export type GroupName = CardGroupName;

/** Kanji numerals shown beside each group heading. @source */
export const GROUP_NUMERALS = ["壱", "弐", "参", "肆", "伍", "陸"] as const;

/** What each group covers, in one line. @source */
export const GROUP_NOTES: Record<GroupName, string> = {
  "Core Stats": "List totals, profile details, and social counts.",
  "Anime Deep Dive": "Genres, tags, studios, voice actors, and distributions.",
  "Manga Deep Dive": "Genres, tags, staff, and distributions.",
  "Activity & Engagement": "Heatmaps, streaks, and recent activity.",
  "Library & Progress": "Favourites, milestones, backlogs, and progress.",
  "Advanced Analytics": "Anime and manga compared side by side.",
};

/** One variation of a card type, with its own preview URL. @source */
export type CardVariation = Readonly<{
  /** Label shown on the variation chip, for example "Pie Chart". */
  name: string;
  /** Card type identifier passed to the card API. */
  cardType: CardId;
  /** Variation identifier passed to the card API. */
  variation: string;
  /** Absolute URL of the rendered SVG. */
  url: string;
}>;

/** A card type together with every variation the generator supports. @source */
export type CardCatalogEntry = Readonly<{
  /** Card identifier the card API accepts, for example `animeStats`. */
  id: CardId;
  title: string;
  description: string;
  group: GroupName;
  icon: HugeIcon;
  variations: CardVariation[];
}>;

/** A group as shown in the page's group navigation. @source */
export type GroupSummary = Readonly<{
  name: GroupName;
  numeral: string;
  note: string;
  anchor: string;
  matchCount: number;
}>;

/**
 * Icon shown beside each card on the examples page and in the generator.
 *
 * Icons live in the catalogue rather than the registry, because the registry is
 * read by server modules that must not pull React in. Adding a card requires one
 * icon entry.
 * @source
 */
const CARD_ICONS: Record<CardId, HugeIcon> = {
  animeStats: BarChart2,
  mangaStats: BookOpen,
  socialStats: Users,
  profileOverview: Users,
  animeMangaOverview: BarChart2,
  animeGenres: PieChart,
  animeTags: PieChart,
  animeVoiceActors: Mic,
  animeStudios: Building2,
  animeStaff: Users,
  animeStatusDistribution: TrendingUp,
  animeFormatDistribution: PieChart,
  animeSourceMaterialDistribution: PieChart,
  animeSeasonalPreference: Calendar,
  animeCountry: PieChart,
  animeScoreDistribution: TrendingUp,
  animeYearDistribution: TrendingUp,
  animeEpisodeLengthPreferences: Clock,
  animeGenreSynergy: BarChart2,
  mangaGenres: PieChart,
  mangaTags: PieChart,
  mangaStaff: Users,
  mangaStatusDistribution: TrendingUp,
  mangaFormatDistribution: PieChart,
  mangaCountry: PieChart,
  mangaScoreDistribution: TrendingUp,
  mangaYearDistribution: TrendingUp,
  activityHeatmap: Calendar,
  recentActivitySummary: Activity,
  recentActivityFeed: Clock,
  activityStreaks: Clock,
  topActivityDays: Activity,
  socialMilestones: TrendingUp,
  reviewStats: BarChart2,
  seasonalViewingPatterns: Calendar,
  favoritesSummary: Heart,
  favoritesGrid: LayoutGrid,
  statusCompletionOverview: TrendingUp,
  milestones: Calendar,
  personalRecords: BarChart2,
  planningBacklog: Clock,
  mostRewatched: Activity,
  currentlyWatchingReading: Clock,
  droppedMedia: Activity,
  scoreCompareAnimeManga: TrendingUp,
  countryDiversity: PieChart,
  genreDiversity: PieChart,
  formatPreferenceOverview: PieChart,
  releaseEraPreference: Calendar,
  startYearMomentum: TrendingUp,
  lengthPreference: TrendingUp,
  tagCategoryDistribution: PieChart,
  tagDiversity: TrendingUp,
  studioCollaboration: Building2,
};

/** Base URL every preview is generated from. @source */
const BASE_URL = DEFAULT_BASE_CARD_URL;
/** Example profile the previews are generated from. @source */
const EXAMPLE_USER_ID = DEFAULT_EXAMPLE_USER_ID;

/**
 * Grid size for the favourites grid card.
 *
 * The card API returns 404 for `favoritesGrid` unless both `gridCols` and
 * `gridRows` are present. The generator defaults both to three.
 * @source
 */
const FAVORITES_GRID_SIZE = 3;

/**
 * Turns a variation's declared extras into card URL parameters.
 *
 * @param extras - Raw extras from the card registry, if any.
 * @returns Partial card URL parameters.
 * @source
 */
function extrasToParams(
  extras: Record<string, string> | undefined,
): Partial<CardUrlParams> {
  const params: Partial<CardUrlParams> = {
    colorPreset: "anilistDarkGradient",
  };

  if (!extras) return params;

  for (const [key, value] of Object.entries(extras)) {
    switch (key) {
      case "statusColors":
        params.statusColors = value === "true";
        break;
      case "colorPreset":
        params.colorPreset = value;
        break;
      case "titleColor":
        params.titleColor = value;
        break;
      case "backgroundColor":
        params.backgroundColor = value;
        break;
      case "textColor":
        params.textColor = value;
        break;
      case "circleColor":
        params.circleColor = value;
        break;
      case "borderColor":
        params.borderColor = value;
        break;
      case "borderRadius": {
        const parsed = Number.parseFloat(value);
        if (!Number.isNaN(parsed)) params.borderRadius = parsed;
        break;
      }
      case "showFavorites":
        params.showFavorites = value === "true";
        break;
      case "piePercentages":
        params.piePercentages = value === "true";
        break;
      default:
        break;
    }
  }

  return params;
}

/**
 * Splits a variation entry into its id and extras.
 * @param entry - Variation as declared in the card registry.
 * @source
 */
function splitVariation(entry: VariationDef): {
  variation: string;
  extras?: Record<string, string>;
} {
  return typeof entry === "string"
    ? { variation: entry }
    : { variation: entry.variation, extras: entry.extras };
}

/**
 * Builds every card type with a preview URL for each variation it supports.
 *
 * @returns The card types in registry order.
 * @source
 */
export function buildCardTypes(): CardCatalogEntry[] {
  return CARD_REGISTRY.map((card) => {
    const variations = card.variations.map((entry) => {
      const { variation, extras } = splitVariation(entry);
      const params = extrasToParams(extras);
      const needsGridSize = card.id === "favoritesGrid";

      const candidate: Partial<StoredCardConfig> = {
        cardName: card.id,
        variation,
        colorPreset: params.colorPreset,
        titleColor: params.titleColor,
        backgroundColor: params.backgroundColor,
        textColor: params.textColor,
        circleColor: params.circleColor,
        borderColor: params.borderColor,
        borderRadius: params.borderRadius,
        showFavorites: params.showFavorites,
        useStatusColors: params.statusColors,
        showPiePercentages: params.piePercentages,
        gridCols: needsGridSize ? FAVORITES_GRID_SIZE : undefined,
        gridRows: needsGridSize ? FAVORITES_GRID_SIZE : undefined,
      };

      return {
        name: VARIATION_LABEL_MAP[variation] ?? variation,
        cardType: card.id,
        variation,
        url: buildCardUrlWithParams(
          mapStoredConfigToCardUrlParams(candidate, {
            userId: EXAMPLE_USER_ID,
            includeColors: false,
          }),
          BASE_URL,
        ),
      };
    });

    return {
      id: card.id,
      title: card.title,
      description: card.description,
      group: card.group,
      icon: CARD_ICONS[card.id],
      variations,
    };
  });
}

/**
 * Anchor id for a group section.
 *
 * @param group - Group name.
 * @returns A URL-safe anchor id.
 * @source
 */
export function groupAnchor(group: GroupName): string {
  return `group-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** A card selection: which card, and which variation of it. @source */
export type CardSelection = Readonly<{
  variation: string;
  showFavourites: boolean;
}>;

/**
 * Every card the generator can render.
 *
 * Each entry carries its stable card id, so selections can be keyed without a
 * second lookup.
 * @source
 */
export const CARD_TYPES: CardCatalogEntry[] = buildCardTypes();

/** Card types keyed by card id. @source */
const CARD_BY_ID = new Map<string, CardCatalogEntry>(
  CARD_TYPES.map((card) => [card.id, card]),
);

/**
 * Looks a card type up by card id.
 * @param id - Card identifier, for example `animeStats`.
 * @returns The card type, or undefined when the id is unknown.
 * @source
 */
export function findCardType(id: string): CardCatalogEntry | undefined {
  return CARD_BY_ID.get(id);
}

/** The six card groups, in catalogue order. @source */
export const GROUP_SUMMARIES = GROUPS.map((name, index) => ({
  name,
  numeral: GROUP_NUMERALS[index],
  note: GROUP_NOTES[name],
  count: CARD_TYPES.filter((card) => card.group === name).length,
}));

/**
 * Card types whose template can list favourites alongside the counted names.
 * Mirrors the set the card API accepts `showFavorites` for.
 * @source
 */
export const FAVOURITE_CARD_TYPES = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/** The card that needs an explicit grid size before the API will render it. @source */
export const GRID_CARD_TYPE = "favoritesGrid";

/**
 * Reads a variation id as a label.
 * @param variation - Variation id, for example `donut`.
 * @returns A human label, falling back to the raw id.
 * @source
 */
export function variationLabel(variation: string): string {
  return VARIATION_LABEL_MAP[variation] ?? variation;
}

/**
 * Filters cards by a search term.
 *
 * Matches the card title, its description, its group, and its variation names,
 * so a search for "donut" finds every chart that offers that shape.
 *
 * @param cards - Cards to filter.
 * @param query - Raw search term.
 * @returns Matching cards, or the input when the term is empty.
 * @source
 */
export function filterCardTypes(
  cards: CardCatalogEntry[],
  query: string,
): CardCatalogEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return cards;

  return cards.filter(
    (card) =>
      card.title.toLowerCase().includes(term) ||
      card.description.toLowerCase().includes(term) ||
      card.group.toLowerCase().includes(term) ||
      card.variations.some((variation) =>
        variationLabel(variation.variation).toLowerCase().includes(term),
      ),
  );
}
