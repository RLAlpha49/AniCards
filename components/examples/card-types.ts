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
  CARD_GROUPS,
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
  VARIATION_LABEL_MAP,
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import type { CardUrlParams } from "@/lib/card-groups";
import type { StoredCardConfig } from "@/lib/types/records";

/**
 * The six groups the generator sorts card types into.
 *
 * These names match the `group` values in `lib/card-catalogue.ts`, so the
 * examples page and the generator use one set of labels.
 * @source
 */
export const GROUPS = [
  "Core Stats",
  "Anime Deep Dive",
  "Manga Deep Dive",
  "Activity & Engagement",
  "Library & Progress",
  "Advanced Analytics",
] as const;

/** A group name from {@link GROUPS}. @source */
export type GroupName = (typeof GROUPS)[number];

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
  cardType: string;
  /** Variation identifier passed to the card API. */
  variation: string;
  /** Absolute URL of the rendered SVG. */
  url: string;
}>;

/** A card type together with every variation the generator supports. @source */
export type CardType = Readonly<{
  /** Card identifier the card API accepts, for example `animeStats`. */
  id: string;
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

/** Metadata for one card type, before its variations are resolved. @source */
type CardTypeMeta = Readonly<{
  title: string;
  description: string;
  group: GroupName;
  icon: HugeIcon;
}>;

/**
 * Every card type the card API renders, in display order.
 *
 * Each description says what the card shows, not which variations it has. The
 * chips on the card list the variations, so the description does not repeat
 * them.
 * @source
 */
const CARD_TYPE_METADATA: CardTypeMeta[] = [
  // Core Stats
  {
    title: "Anime Statistics",
    description:
      "Totals for your anime list: count, episodes, minutes, and mean score",
    group: "Core Stats",
    icon: BarChart2,
  },
  {
    title: "Manga Statistics",
    description:
      "Totals for your manga list: count, chapters, volumes, and mean score",
    group: "Core Stats",
    icon: BookOpen,
  },
  {
    title: "Social Statistics",
    description: "Followers, following, threads, and reviews",
    group: "Core Stats",
    icon: Users,
  },
  {
    title: "Profile Overview",
    description: "Your avatar, banner, and list totals",
    group: "Core Stats",
    icon: Users,
  },
  {
    title: "Anime vs Manga Overview",
    description: "Anime and manga totals side by side",
    group: "Core Stats",
    icon: BarChart2,
  },

  // Anime Deep Dive
  {
    title: "Anime Genres",
    description: "Time spent in each genre",
    group: "Anime Deep Dive",
    icon: PieChart,
  },
  {
    title: "Anime Tags",
    description: "Tags that appear most across your anime",
    group: "Anime Deep Dive",
    icon: PieChart,
  },
  {
    title: "Voice Actors",
    description: "Voice actors with the most roles in your list",
    group: "Anime Deep Dive",
    icon: Mic,
  },
  {
    title: "Animation Studios",
    description: "Studios behind the anime you watched",
    group: "Anime Deep Dive",
    icon: Building2,
  },
  {
    title: "Anime Staff",
    description: "Staff credited on the anime you watched",
    group: "Anime Deep Dive",
    icon: Users,
  },
  {
    title: "Anime Status Distribution",
    description: "How your anime splits across watching statuses",
    group: "Anime Deep Dive",
    icon: TrendingUp,
  },
  {
    title: "Anime Format Distribution",
    description: "How your anime splits across TV, movie, OVA, and the rest",
    group: "Anime Deep Dive",
    icon: PieChart,
  },
  {
    title: "Anime Source Material Distribution",
    description:
      "Where your anime came from: manga, original, light novel, and the rest",
    group: "Anime Deep Dive",
    icon: PieChart,
  },
  {
    title: "Anime Seasonal Preference",
    description: "Which seasons your anime aired in",
    group: "Anime Deep Dive",
    icon: Calendar,
  },
  {
    title: "Anime Country Distribution",
    description: "Countries of origin across your anime",
    group: "Anime Deep Dive",
    icon: PieChart,
  },
  {
    title: "Anime Score Distribution",
    description: "How many titles sit at each score",
    group: "Anime Deep Dive",
    icon: TrendingUp,
  },
  {
    title: "Anime Year Distribution",
    description: "Release years across your anime",
    group: "Anime Deep Dive",
    icon: TrendingUp,
  },
  {
    title: "Episode Length Preferences",
    description: "Episode lengths you watch most",
    group: "Anime Deep Dive",
    icon: Clock,
  },
  {
    title: "Genre Synergy",
    description: "Genres that show up together in your list",
    group: "Anime Deep Dive",
    icon: BarChart2,
  },

  // Manga Deep Dive
  {
    title: "Manga Genres",
    description: "Time spent in each genre",
    group: "Manga Deep Dive",
    icon: PieChart,
  },
  {
    title: "Manga Tags",
    description: "Tags that appear most across your manga",
    group: "Manga Deep Dive",
    icon: PieChart,
  },
  {
    title: "Manga Staff",
    description: "Staff credited on the manga you read",
    group: "Manga Deep Dive",
    icon: Users,
  },
  {
    title: "Manga Status Distribution",
    description: "How your manga splits across reading statuses",
    group: "Manga Deep Dive",
    icon: TrendingUp,
  },
  {
    title: "Manga Format Distribution",
    description: "How your manga splits across manga, novel, and the rest",
    group: "Manga Deep Dive",
    icon: PieChart,
  },
  {
    title: "Manga Country Distribution",
    description: "Countries of origin across your manga",
    group: "Manga Deep Dive",
    icon: PieChart,
  },
  {
    title: "Manga Score Distribution",
    description: "How many titles sit at each score",
    group: "Manga Deep Dive",
    icon: TrendingUp,
  },
  {
    title: "Manga Year Distribution",
    description: "Release years across your manga",
    group: "Manga Deep Dive",
    icon: TrendingUp,
  },

  // Activity & Engagement
  {
    title: "Activity Heatmap",
    description: "A calendar of your daily activity",
    group: "Activity & Engagement",
    icon: Calendar,
  },
  {
    title: "Recent Activity Summary",
    description: "A sparkline of activity over recent weeks",
    group: "Activity & Engagement",
    icon: Activity,
  },
  {
    title: "Recent Activity Feed",
    description: "Your latest activity, newest first",
    group: "Activity & Engagement",
    icon: Clock,
  },
  {
    title: "Activity Streaks",
    description: "Your current and longest streaks",
    group: "Activity & Engagement",
    icon: Clock,
  },
  {
    title: "Top Activity Days",
    description: "The days you were most active",
    group: "Activity & Engagement",
    icon: Activity,
  },
  {
    title: "Social Milestones",
    description: "Milestones from your social activity",
    group: "Activity & Engagement",
    icon: TrendingUp,
  },
  {
    title: "Review Statistics",
    description: "Your reviews and the scores you gave them",
    group: "Activity & Engagement",
    icon: BarChart2,
  },
  {
    title: "Seasonal Viewing Patterns",
    description: "When you watch, by day of the week and month",
    group: "Activity & Engagement",
    icon: Calendar,
  },

  // Library & Progress
  {
    title: "Favourites Summary",
    description: "Counts of your favourite anime, manga, and characters",
    group: "Library & Progress",
    icon: Heart,
  },
  {
    title: "Favourites Grid",
    description: "A grid of your favourites, in the mix you choose",
    group: "Library & Progress",
    icon: LayoutGrid,
  },
  {
    title: "Status Completion Overview",
    description: "Anime and manga completion totals, together or split",
    group: "Library & Progress",
    icon: TrendingUp,
  },
  {
    title: "Consumption Milestones",
    description: "Your biggest anime and manga milestones",
    group: "Library & Progress",
    icon: Calendar,
  },
  {
    title: "Personal Records",
    description: "Your highest and longest completed titles",
    group: "Library & Progress",
    icon: BarChart2,
  },
  {
    title: "Planning Backlog",
    description: "What is sitting in your planning list",
    group: "Library & Progress",
    icon: Clock,
  },
  {
    title: "Most Rewatched/Reread",
    description: "Titles you have revisited most",
    group: "Library & Progress",
    icon: Activity,
  },
  {
    title: "Currently Watching / Reading",
    description: "What you have in progress right now",
    group: "Library & Progress",
    icon: Clock,
  },
  {
    title: "Dropped Media",
    description: "Titles you dropped, and where you stopped",
    group: "Library & Progress",
    icon: Activity,
  },

  // Advanced Analytics
  {
    title: "Anime vs Manga Score Comparison",
    description: "Your scores in anime against your scores in manga",
    group: "Advanced Analytics",
    icon: TrendingUp,
  },
  {
    title: "Country Diversity",
    description: "How varied the countries are in each list",
    group: "Advanced Analytics",
    icon: PieChart,
  },
  {
    title: "Genre Diversity",
    description: "How varied the genres are in each list",
    group: "Advanced Analytics",
    icon: PieChart,
  },
  {
    title: "Format Preference Overview",
    description: "Formats you pick in anime against manga",
    group: "Advanced Analytics",
    icon: PieChart,
  },
  {
    title: "Release Era Preference",
    description: "Which release eras you consume most",
    group: "Advanced Analytics",
    icon: Calendar,
  },
  {
    title: "Start-Year Momentum",
    description: "How your start years differ between anime and manga",
    group: "Advanced Analytics",
    icon: TrendingUp,
  },
  {
    title: "Length Preference",
    description: "Short series against long ones in each list",
    group: "Advanced Analytics",
    icon: TrendingUp,
  },
  {
    title: "Tag Category Distribution",
    description: "Tag categories in anime against manga",
    group: "Advanced Analytics",
    icon: PieChart,
  },
  {
    title: "Tag Diversity",
    description: "How varied the tags are in each list",
    group: "Advanced Analytics",
    icon: TrendingUp,
  },
  {
    title: "Studio Collaboration",
    description: "Studios that keep working together in your list",
    group: "Advanced Analytics",
    icon: Building2,
  },
];

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
 * @param extras - Raw extras from {@link CARD_GROUPS}, if any.
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
 * Builds every card type with a preview URL for each variation it supports.
 *
 * @returns The card types in group order.
 * @source
 */
export function buildCardTypes(): CardType[] {
  return CARD_TYPE_METADATA.map((meta) => {
    const group = CARD_GROUPS.find((entry) => entry.cardTitle === meta.title);

    if (!group) return { ...meta, id: "", variations: [] };

    const variations = group.variations.map((entry) => {
      const variation = typeof entry === "string" ? entry : entry.variation;
      const extras = typeof entry === "string" ? undefined : entry.extras;
      const params = extrasToParams(extras);
      const needsGridSize = group.cardType === "favoritesGrid";

      const candidate: Partial<StoredCardConfig> = {
        cardName: group.cardType,
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
        cardType: group.cardType,
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

    return { ...meta, id: group.cardType, variations };
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
