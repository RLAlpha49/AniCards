import type {
  ExampleCardType,
  ExampleCategory,
  ExamplesCatalogPayload,
} from "@/components/examples";
import { CARD_GROUPS, VARIATION_LABEL_MAP } from "@/lib/card-groups";
import {
  buildThemePreviewUrls,
  buildThemeSettingsSnapshots,
  getPreviewCardDimensions,
} from "@/lib/card-preview";

const EXAMPLES_CATEGORIES = [
  "Core Stats",
  "Anime Deep Dive",
  "Manga Deep Dive",
  "Activity & Engagement",
  "Library & Progress",
  "Advanced Analytics",
] as const satisfies readonly ExampleCategory[];

type CardTypeMeta = Omit<ExampleCardType, "variants">;

const CARD_TYPE_METADATA: CardTypeMeta[] = [
  {
    title: "Anime Statistics",
    description:
      "A wide-angle snapshot of your anime watching habits — pick the layout that suits you",
    category: "Core Stats",
    iconKey: "barChart2",
  },
  {
    title: "Manga Statistics",
    description:
      "Your manga reading stats at a glance, available in several visual formats",
    category: "Core Stats",
    iconKey: "bookOpen",
  },
  {
    title: "Social Statistics",
    description:
      "How you show up in the community — thread activity, follows, and everything social",
    category: "Core Stats",
    iconKey: "users",
  },
  {
    title: "Profile Overview",
    description:
      "Your avatar, banner, and headline numbers wrapped into one tidy card",
    category: "Core Stats",
    iconKey: "users",
  },
  {
    title: "Anime vs Manga Overview",
    description: "Anime versus manga — a quick side-by-side of your two habits",
    category: "Core Stats",
    iconKey: "barChart2",
  },
  {
    title: "Anime Genres",
    description:
      "Which genres pull you in? This maps your anime taste with several chart styles",
    category: "Anime Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Anime Tags",
    description: "The tags that keep surfacing across your anime library",
    category: "Anime Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Voice Actors",
    description:
      "Voice actors you've heard more than anyone else in your lineup",
    category: "Anime Deep Dive",
    iconKey: "mic",
  },
  {
    title: "Animation Studios",
    description: "A studio-by-studio breakdown of where your anime comes from",
    category: "Anime Deep Dive",
    iconKey: "building2",
  },
  {
    title: "Studio Collaboration",
    description: "Which studios team up most often in the shows you watch",
    category: "Anime Deep Dive",
    iconKey: "building2",
  },
  {
    title: "Anime Staff",
    description:
      "The directors, writers, and key staff behind the anime you gravitate toward",
    category: "Anime Deep Dive",
    iconKey: "users",
  },
  {
    title: "Anime Status Distribution",
    description:
      "Where things stand — watching, completed, dropped — with optional color coding",
    category: "Anime Deep Dive",
    iconKey: "trendingUp",
  },
  {
    title: "Anime Format Distribution",
    description:
      "TV series, movies, OVAs — see which formats dominate your watchlist",
    category: "Anime Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Anime Source Material Distribution",
    description:
      "Adapted from manga? An original? Light novel? See where your anime originated",
    category: "Anime Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Anime Seasonal Preference",
    description:
      "Winter premieres or summer blockbusters — find out which season owns your list",
    category: "Anime Deep Dive",
    iconKey: "calendar",
  },
  {
    title: "Anime Country Distribution",
    description:
      "Where in the world your anime was produced — country by country",
    category: "Anime Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Anime Score Distribution",
    description: "How your scores actually spread out across your anime list",
    category: "Anime Deep Dive",
    iconKey: "trendingUp",
  },
  {
    title: "Anime Year Distribution",
    description: "A timeline of when the anime on your list first aired",
    category: "Anime Deep Dive",
    iconKey: "trendingUp",
  },
  {
    title: "Episode Length Preferences",
    description:
      "Short-form bites or full-length episodes — see where your preferences land",
    category: "Anime Deep Dive",
    iconKey: "clock",
  },
  {
    title: "Genre Synergy",
    description:
      "The genre pairings that show up together most in your collection",
    category: "Anime Deep Dive",
    iconKey: "barChart2",
  },
  {
    title: "Manga Genres",
    description: "Which manga genres keep pulling you back in",
    category: "Manga Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Manga Tags",
    description: "Recurring tags scattered across your manga shelves",
    category: "Manga Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Manga Staff",
    description:
      "The mangaka and staff who show up most across your reading list",
    category: "Manga Deep Dive",
    iconKey: "users",
  },
  {
    title: "Manga Status Distribution",
    description:
      "Reading, finished, on hold — a snapshot of where each title sits",
    category: "Manga Deep Dive",
    iconKey: "trendingUp",
  },
  {
    title: "Manga Format Distribution",
    description:
      "Manga proper, light novels, one-shots — your format split at a glance",
    category: "Manga Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Manga Country Distribution",
    description: "Country of origin for every manga in your collection",
    category: "Manga Deep Dive",
    iconKey: "pieChart",
  },
  {
    title: "Manga Score Distribution",
    description: "How generous (or harsh) your manga scores really are",
    category: "Manga Deep Dive",
    iconKey: "trendingUp",
  },
  {
    title: "Manga Year Distribution",
    description:
      "When the manga on your list was first published, year by year",
    category: "Manga Deep Dive",
    iconKey: "trendingUp",
  },
  {
    title: "Recent Activity Summary",
    description:
      "A quick pulse check — sparklines and numbers from your latest activity",
    category: "Activity & Engagement",
    iconKey: "activity",
  },
  {
    title: "Activity Streaks",
    description: "Your current streak and your all-time best, side by side",
    category: "Activity & Engagement",
    iconKey: "clock",
  },
  {
    title: "Top Activity Days",
    description: "The days you went hardest — ranked by raw activity volume",
    category: "Activity & Engagement",
    iconKey: "activity",
  },
  {
    title: "Social Milestones",
    description:
      "Unlocked milestones and social achievements worth bragging about",
    category: "Activity & Engagement",
    iconKey: "trendingUp",
  },
  {
    title: "Review Statistics",
    description:
      "How often you review, what you rate, and the scores you hand out",
    category: "Activity & Engagement",
    iconKey: "barChart2",
  },
  {
    title: "Seasonal Viewing Patterns",
    description:
      "When do you actually watch? Spot your peak days and busiest months",
    category: "Activity & Engagement",
    iconKey: "calendar",
  },
  {
    title: "Favourites Summary",
    description:
      "Your top picks — favourite anime, manga, and characters — all on a single card",
    category: "Library & Progress",
    iconKey: "heart",
  },
  {
    title: "Favourites Grid",
    description:
      "A flexible grid of favourites you can mix and match however you like",
    category: "Library & Progress",
    iconKey: "layoutGrid",
  },
  {
    title: "Status Completion Overview",
    description:
      "Completion tally for anime and manga — view them together or split apart",
    category: "Library & Progress",
    iconKey: "trendingUp",
  },
  {
    title: "Consumption Milestones",
    description:
      "The big landmarks in your anime and manga journey, worth celebrating",
    category: "Library & Progress",
    iconKey: "calendar",
  },
  {
    title: "Personal Records",
    description: "Personal bests and the standout titles that earned them",
    category: "Library & Progress",
    iconKey: "barChart2",
  },
  {
    title: "Planning Backlog",
    description:
      "Everything still sitting in your plan-to-watch and plan-to-read pile",
    category: "Library & Progress",
    iconKey: "clock",
  },
  {
    title: "Most Rewatched/Reread",
    description:
      "The titles you keep coming back to — your most rewatched and reread",
    category: "Library & Progress",
    iconKey: "activity",
  },
  {
    title: "Currently Watching / Reading",
    description:
      "What's on your plate right now, with options to filter by anime or manga only",
    category: "Library & Progress",
    iconKey: "clock",
  },
  {
    title: "Dropped Media",
    description:
      "The ones that didn't make the cut — every title you've walked away from",
    category: "Library & Progress",
    iconKey: "activity",
  },
  {
    title: "Anime vs Manga Score Comparison",
    description:
      "Do you score anime and manga the same way? This card settles the debate",
    category: "Advanced Analytics",
    iconKey: "trendingUp",
  },
  {
    title: "Country Diversity",
    description: "How worldly is your taste? Country diversity, anime vs manga",
    category: "Advanced Analytics",
    iconKey: "pieChart",
  },
  {
    title: "Genre Diversity",
    description:
      "Genre spread across both media — are you more adventurous with one than the other?",
    category: "Advanced Analytics",
    iconKey: "pieChart",
  },
  {
    title: "Format Preference Overview",
    description:
      "TV vs manga proper, movies vs one-shots — your format leanings compared",
    category: "Advanced Analytics",
    iconKey: "pieChart",
  },
  {
    title: "Release Era Preference",
    description:
      "Classic era fan or modern-day devotee? See where most of your picks land",
    category: "Advanced Analytics",
    iconKey: "calendar",
  },
  {
    title: "Start-Year Momentum",
    description:
      "When did you start picking up new titles? Track the momentum year by year",
    category: "Advanced Analytics",
    iconKey: "trendingUp",
  },
  {
    title: "Length Preference",
    description:
      "Quick reads and binge-watches vs sprawling epics — see which side wins",
    category: "Advanced Analytics",
    iconKey: "trendingUp",
  },
  {
    title: "Tag Category Distribution",
    description:
      "How your tag preferences stack up when you put anime and manga next to each other",
    category: "Advanced Analytics",
    iconKey: "pieChart",
  },
  {
    title: "Tag Diversity",
    description:
      "Are your anime tags all over the map while manga stays niche? Find out",
    category: "Advanced Analytics",
    iconKey: "pieChart",
  },
];

const CARD_GROUPS_BY_TITLE = new Map(
  CARD_GROUPS.map((cardGroup) => [cardGroup.cardTitle, cardGroup]),
);

const EXAMPLES_CARD_TYPES: ExampleCardType[] = CARD_TYPE_METADATA.map(
  (cardType) => {
    const group = CARD_GROUPS_BY_TITLE.get(cardType.title);

    if (!group) {
      return {
        ...cardType,
        variants: [],
      };
    }

    return {
      ...cardType,
      variants: group.variations.map((variationDefinition) => {
        const normalizedVariation =
          typeof variationDefinition === "string"
            ? { variation: variationDefinition, extras: undefined }
            : variationDefinition;
        const { w, h } = getPreviewCardDimensions(
          group.cardType,
          normalizedVariation.variation,
        );

        return {
          name:
            VARIATION_LABEL_MAP[normalizedVariation.variation] ??
            normalizedVariation.variation,
          previewUrls: buildThemePreviewUrls({
            cardType: group.cardType,
            variation: normalizedVariation.variation,
            extras: normalizedVariation.extras,
          }),
          settingsSnapshots: buildThemeSettingsSnapshots({
            extras: normalizedVariation.extras,
          }),
          width: w,
          height: h,
        };
      }),
    };
  },
);

const CATEGORY_INFO = EXAMPLES_CATEGORIES.map((category) => ({
  name: category,
  count: EXAMPLES_CARD_TYPES.filter(
    (cardType) => cardType.category === category,
  ).length,
}));

const EXAMPLES_CATALOG: ExamplesCatalogPayload = {
  categories: EXAMPLES_CATEGORIES,
  categoryInfo: CATEGORY_INFO,
  cardTypes: EXAMPLES_CARD_TYPES,
  totalCardTypes: EXAMPLES_CARD_TYPES.length,
  totalVariants: EXAMPLES_CARD_TYPES.reduce(
    (sum, cardType) => sum + cardType.variants.length,
    0,
  ),
};

export function getExamplesCatalog(): ExamplesCatalogPayload {
  return EXAMPLES_CATALOG;
}
