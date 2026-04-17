import type {
  ExampleCardType,
  ExampleCardVariant,
  ExampleCategory,
  ExamplesCatalogPayload,
} from "@/components/examples";
import { CARD_GROUPS, VARIATION_LABEL_MAP } from "@/lib/card-groups";
import {
  buildThemePreviewUrls,
  buildThemeSettingsSnapshots,
} from "@/lib/card-preview";
import { getPreviewCardDimensions } from "@/lib/card-preview-dimensions";

const EXAMPLES_CATEGORIES = [
  "Core Stats",
  "Anime Deep Dive",
  "Manga Deep Dive",
  "Activity & Engagement",
  "Library & Progress",
  "Advanced Analytics",
] as const satisfies readonly ExampleCategory[];

const EXAMPLES_COLLECTION_KEYWORDS: Record<ExampleCategory, readonly string[]> =
  {
    "Core Stats": ["headline stats", "profile summary", "overall overview"],
    "Anime Deep Dive": [
      "anime breakdown",
      "watch history",
      "genre and studio analysis",
    ],
    "Manga Deep Dive": ["manga breakdown", "reading history", "manga analysis"],
    "Activity & Engagement": [
      "activity history",
      "social engagement",
      "review activity",
    ],
    "Library & Progress": [
      "library progress",
      "favorites and backlog",
      "watching now",
      "reading now",
    ],
    "Advanced Analytics": [
      "anime vs manga comparison",
      "cross media comparison",
      "diversity analysis",
    ],
  };

type CardTypeMeta = Omit<ExampleCardType, "variants" | "searchText">;
type CardTypeMetaEntry = readonly [
  title: CardTypeMeta["title"],
  description: CardTypeMeta["description"],
  iconKey: CardTypeMeta["iconKey"],
];

function normalizeExamplesSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSearchableVariantName(name: string): boolean {
  const normalizedName = normalizeExamplesSearchText(name);

  return (
    normalizedName.length > 0 &&
    normalizedName !== "default" &&
    !normalizedName.startsWith("default ")
  );
}

function buildCardTypeSearchText(
  cardType: CardTypeMeta,
  variants: readonly ExampleCardVariant[],
): string {
  const searchableEntries = new Set<string>();

  const addSearchEntry = (value: string | undefined) => {
    if (!value) {
      return;
    }

    const normalizedValue = normalizeExamplesSearchText(value);

    if (normalizedValue.length > 0) {
      searchableEntries.add(normalizedValue);
    }
  };

  addSearchEntry(cardType.title);
  addSearchEntry(cardType.description);
  addSearchEntry(cardType.category);

  for (const keyword of EXAMPLES_COLLECTION_KEYWORDS[cardType.category]) {
    addSearchEntry(keyword);
  }

  for (const variant of variants) {
    if (isSearchableVariantName(variant.name)) {
      addSearchEntry(variant.name);
    }
  }

  return Array.from(searchableEntries).join(" ");
}

function buildCardTypeMetadata(
  category: ExampleCategory,
  entries: readonly CardTypeMetaEntry[],
): CardTypeMeta[] {
  return entries.map(([title, description, iconKey]) => ({
    title,
    description,
    category,
    iconKey,
  }));
}

const CARD_TYPE_METADATA: CardTypeMeta[] = [
  ...buildCardTypeMetadata("Core Stats", [
    [
      "Anime Statistics",
      "A wide-angle snapshot of your anime watching habits — pick the layout that suits you",
      "barChart2",
    ],
    [
      "Manga Statistics",
      "Your manga reading stats at a glance, available in several visual formats",
      "bookOpen",
    ],
    [
      "Social Statistics",
      "How you show up in the community — thread activity, follows, and everything social",
      "users",
    ],
    [
      "Profile Overview",
      "Your avatar, banner, and headline numbers wrapped into one tidy card",
      "users",
    ],
    [
      "Anime vs Manga Overview",
      "Anime versus manga — a quick side-by-side of your two habits",
      "barChart2",
    ],
  ]),
  ...buildCardTypeMetadata("Anime Deep Dive", [
    [
      "Anime Genres",
      "Which genres pull you in? This maps your anime taste with several chart styles",
      "pieChart",
    ],
    [
      "Anime Tags",
      "The tags that keep surfacing across your anime library",
      "pieChart",
    ],
    [
      "Voice Actors",
      "Voice actors you've heard more than anyone else in your lineup",
      "mic",
    ],
    [
      "Animation Studios",
      "A studio-by-studio breakdown of where your anime comes from",
      "building2",
    ],
    [
      "Studio Collaboration",
      "Which studios team up most often in the shows you watch",
      "building2",
    ],
    [
      "Anime Staff",
      "The directors, writers, and key staff behind the anime you gravitate toward",
      "users",
    ],
    [
      "Anime Status Distribution",
      "Where things stand — watching, completed, dropped — with optional color coding",
      "trendingUp",
    ],
    [
      "Anime Format Distribution",
      "TV series, movies, OVAs — see which formats dominate your watchlist",
      "pieChart",
    ],
    [
      "Anime Source Material Distribution",
      "Adapted from manga? An original? Light novel? See where your anime originated",
      "pieChart",
    ],
    [
      "Anime Seasonal Preference",
      "Winter premieres or summer blockbusters — find out which season owns your list",
      "calendar",
    ],
    [
      "Anime Country Distribution",
      "Where in the world your anime was produced — country by country",
      "pieChart",
    ],
    [
      "Anime Score Distribution",
      "How your scores actually spread out across your anime list",
      "trendingUp",
    ],
    [
      "Anime Year Distribution",
      "A timeline of when the anime on your list first aired",
      "trendingUp",
    ],
    [
      "Episode Length Preferences",
      "Short-form bites or full-length episodes — see where your preferences land",
      "clock",
    ],
    [
      "Genre Synergy",
      "The genre pairings that show up together most in your collection",
      "barChart2",
    ],
  ]),
  ...buildCardTypeMetadata("Manga Deep Dive", [
    ["Manga Genres", "Which manga genres keep pulling you back in", "pieChart"],
    [
      "Manga Tags",
      "Recurring tags scattered across your manga shelves",
      "pieChart",
    ],
    [
      "Manga Staff",
      "The mangaka and staff who show up most across your reading list",
      "users",
    ],
    [
      "Manga Status Distribution",
      "Reading, finished, on hold — a snapshot of where each title sits",
      "trendingUp",
    ],
    [
      "Manga Format Distribution",
      "Manga proper, light novels, one-shots — your format split at a glance",
      "pieChart",
    ],
    [
      "Manga Country Distribution",
      "Country of origin for every manga in your collection",
      "pieChart",
    ],
    [
      "Manga Score Distribution",
      "How generous (or harsh) your manga scores really are",
      "trendingUp",
    ],
    [
      "Manga Year Distribution",
      "When the manga on your list was first published, year by year",
      "trendingUp",
    ],
  ]),
  ...buildCardTypeMetadata("Activity & Engagement", [
    [
      "Recent Activity Summary",
      "A quick pulse check — sparklines and numbers from your latest activity",
      "activity",
    ],
    [
      "Activity Streaks",
      "Your current streak and your all-time best, side by side",
      "clock",
    ],
    [
      "Top Activity Days",
      "The days you went hardest — ranked by raw activity volume",
      "activity",
    ],
    [
      "Social Milestones",
      "Unlocked milestones and social achievements worth bragging about",
      "trendingUp",
    ],
    [
      "Review Statistics",
      "How often you review, what you rate, and the scores you hand out",
      "barChart2",
    ],
    [
      "Seasonal Viewing Patterns",
      "When do you actually watch? Spot your peak days and busiest months",
      "calendar",
    ],
  ]),
  ...buildCardTypeMetadata("Library & Progress", [
    [
      "Favourites Summary",
      "Your top picks — favourite anime, manga, and characters — all on a single card",
      "heart",
    ],
    [
      "Favourites Grid",
      "A flexible grid of favourites you can mix and match however you like",
      "layoutGrid",
    ],
    [
      "Status Completion Overview",
      "Completion tally for anime and manga — view them together or split apart",
      "trendingUp",
    ],
    [
      "Consumption Milestones",
      "The big landmarks in your anime and manga journey, worth celebrating",
      "calendar",
    ],
    [
      "Personal Records",
      "Personal bests and the standout titles that earned them",
      "barChart2",
    ],
    [
      "Planning Backlog",
      "Everything still sitting in your plan-to-watch and plan-to-read pile",
      "clock",
    ],
    [
      "Most Rewatched/Reread",
      "The titles you keep coming back to — your most rewatched and reread",
      "activity",
    ],
    [
      "Currently Watching / Reading",
      "What's on your plate right now, with options to filter by anime or manga only",
      "clock",
    ],
    [
      "Dropped Media",
      "The ones that didn't make the cut — every title you've walked away from",
      "activity",
    ],
  ]),
  ...buildCardTypeMetadata("Advanced Analytics", [
    [
      "Anime vs Manga Score Comparison",
      "Do you score anime and manga the same way? This card settles the debate",
      "trendingUp",
    ],
    [
      "Country Diversity",
      "How worldly is your taste? Country diversity, anime vs manga",
      "pieChart",
    ],
    [
      "Genre Diversity",
      "Genre spread across both media — are you more adventurous with one than the other?",
      "pieChart",
    ],
    [
      "Format Preference Overview",
      "TV vs manga proper, movies vs one-shots — your format leanings compared",
      "pieChart",
    ],
    [
      "Release Era Preference",
      "Classic era fan or modern-day devotee? See where most of your picks land",
      "calendar",
    ],
    [
      "Start-Year Momentum",
      "When did you start picking up new titles? Track the momentum year by year",
      "trendingUp",
    ],
    [
      "Length Preference",
      "Quick reads and binge-watches vs sprawling epics — see which side wins",
      "trendingUp",
    ],
    [
      "Tag Category Distribution",
      "How your tag preferences stack up when you put anime and manga next to each other",
      "pieChart",
    ],
    [
      "Tag Diversity",
      "Are your anime tags all over the map while manga stays niche? Find out",
      "pieChart",
    ],
  ]),
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
        searchText: buildCardTypeSearchText(cardType, []),
      };
    }

    const variants = group.variations.map((variationDefinition) => {
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
    });

    return {
      ...cardType,
      variants,
      searchText: buildCardTypeSearchText(cardType, variants),
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
