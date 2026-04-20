import type {
  ExampleCardType,
  ExampleCardVariant,
  ExampleCategory,
  ExamplesCatalogPayload,
  ExamplesCatalogSummary,
} from "@/components/examples";
import { CARD_GROUPS, VARIATION_LABEL_MAP } from "@/lib/card-groups";
import {
  buildThemePreviewUrls,
  buildThemeSettingsSnapshots,
} from "@/lib/card-preview";
import { getPreviewCardDimensions } from "@/lib/card-preview-dimensions";
import { getStatCardType } from "@/lib/card-types";
import {
  buildExamplesCollectionPath,
  EXAMPLE_COLLECTIONS,
  getExampleCollectionByCategory,
  getExampleCollectionBySlug,
} from "@/lib/examples-collections";

const EXAMPLES_CATEGORIES = EXAMPLE_COLLECTIONS.map(
  (collection) => collection.name,
) as readonly ExampleCategory[];

type CardTypeMeta = Omit<ExampleCardType, "variants" | "searchText"> & {
  searchAliases?: readonly string[];
};
type CardTypeMetaEntry = readonly [
  id: CardTypeMeta["id"],
  description: CardTypeMeta["description"],
  iconKey: CardTypeMeta["iconKey"],
  searchAliases?: readonly string[],
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
  const collection = getExampleCollectionByCategory(cardType.category);

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
  addSearchEntry(cardType.id);

  for (const alias of cardType.searchAliases ?? []) {
    addSearchEntry(alias);
  }

  for (const keyword of collection.keywords) {
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
  return entries.map(([id, description, iconKey, searchAliases]) => {
    const canonicalCardType = getStatCardType(id);

    if (!canonicalCardType) {
      throw new Error(`Unknown example card type: ${id}`);
    }

    if (canonicalCardType.group !== category) {
      throw new Error(
        `Example card type ${id} is assigned to ${category}, but the canonical registry groups it under ${canonicalCardType.group}.`,
      );
    }

    return {
      id,
      title: canonicalCardType.label,
      description,
      category,
      iconKey,
      searchAliases,
    } satisfies CardTypeMeta;
  });
}

const CARD_TYPE_METADATA: CardTypeMeta[] = [
  ...buildCardTypeMetadata("Core Stats", [
    [
      "animeStats",
      "A wide-angle snapshot of your anime watching habits — pick the layout that suits you",
      "barChart2",
      ["Anime Statistics"],
    ],
    [
      "mangaStats",
      "Your manga reading stats at a glance, available in several visual formats",
      "bookOpen",
      ["Manga Statistics"],
    ],
    [
      "socialStats",
      "How you show up in the community — thread activity, follows, and everything social",
      "users",
      ["Social Statistics"],
    ],
    [
      "profileOverview",
      "Your avatar, banner, and headline numbers wrapped into one tidy card",
      "users",
    ],
    [
      "animeMangaOverview",
      "Anime versus manga — a quick side-by-side of your two habits",
      "barChart2",
    ],
  ]),
  ...buildCardTypeMetadata("Anime Deep Dive", [
    [
      "animeGenres",
      "Which genres pull you in? This maps your anime taste with several chart styles",
      "pieChart",
    ],
    [
      "animeTags",
      "The tags that keep surfacing across your anime library",
      "pieChart",
    ],
    [
      "animeVoiceActors",
      "Voice actors you've heard more than anyone else in your lineup",
      "mic",
    ],
    [
      "animeStudios",
      "A studio-by-studio breakdown of where your anime comes from",
      "building2",
      ["Animation Studios"],
    ],
    [
      "studioCollaboration",
      "Which studios team up most often in the shows you watch",
      "building2",
    ],
    [
      "animeStaff",
      "The directors, writers, and key staff behind the anime you gravitate toward",
      "users",
    ],
    [
      "animeStatusDistribution",
      "Where things stand — watching, completed, dropped — with optional color coding",
      "trendingUp",
    ],
    [
      "animeFormatDistribution",
      "TV series, movies, OVAs — see which formats dominate your watchlist",
      "pieChart",
    ],
    [
      "animeSourceMaterialDistribution",
      "Adapted from manga? An original? Light novel? See where your anime originated",
      "pieChart",
    ],
    [
      "animeSeasonalPreference",
      "Winter premieres or summer blockbusters — find out which season owns your list",
      "calendar",
    ],
    [
      "animeCountry",
      "Where in the world your anime was produced — country by country",
      "pieChart",
      ["Anime Country Distribution"],
    ],
    [
      "animeScoreDistribution",
      "How your scores actually spread out across your anime list",
      "trendingUp",
    ],
    [
      "animeYearDistribution",
      "A timeline of when the anime on your list first aired",
      "trendingUp",
    ],
    [
      "animeEpisodeLengthPreferences",
      "Short-form bites or full-length episodes — see where your preferences land",
      "clock",
    ],
    [
      "animeGenreSynergy",
      "The genre pairings that show up together most in your collection",
      "barChart2",
    ],
  ]),
  ...buildCardTypeMetadata("Manga Deep Dive", [
    ["mangaGenres", "Which manga genres keep pulling you back in", "pieChart"],
    [
      "mangaTags",
      "Recurring tags scattered across your manga shelves",
      "pieChart",
    ],
    [
      "mangaStaff",
      "The mangaka and staff who show up most across your reading list",
      "users",
    ],
    [
      "mangaStatusDistribution",
      "Reading, finished, on hold — a snapshot of where each title sits",
      "trendingUp",
    ],
    [
      "mangaFormatDistribution",
      "Manga proper, light novels, one-shots — your format split at a glance",
      "pieChart",
    ],
    [
      "mangaCountry",
      "Country of origin for every manga in your collection",
      "pieChart",
    ],
    [
      "mangaScoreDistribution",
      "How generous (or harsh) your manga scores really are",
      "trendingUp",
    ],
    [
      "mangaYearDistribution",
      "When the manga on your list was first published, year by year",
      "trendingUp",
    ],
  ]),
  ...buildCardTypeMetadata("Activity & Engagement", [
    [
      "recentActivitySummary",
      "A quick pulse check — sparklines and numbers from your latest activity",
      "activity",
    ],
    [
      "activityStreaks",
      "Your current streak and your all-time best, side by side",
      "clock",
    ],
    [
      "topActivityDays",
      "The days you went hardest — ranked by raw activity volume",
      "activity",
    ],
    [
      "socialMilestones",
      "Unlocked milestones and social achievements worth bragging about",
      "trendingUp",
    ],
    [
      "reviewStats",
      "How often you review, what you rate, and the scores you hand out",
      "barChart2",
    ],
    [
      "seasonalViewingPatterns",
      "When do you actually watch? Spot your peak days and busiest months",
      "calendar",
    ],
  ]),
  ...buildCardTypeMetadata("Library & Progress", [
    [
      "favoritesSummary",
      "Your top picks — favourite anime, manga, and characters — all on a single card",
      "heart",
    ],
    [
      "favoritesGrid",
      "A flexible grid of favourites you can mix and match however you like",
      "layoutGrid",
    ],
    [
      "statusCompletionOverview",
      "Completion tally for anime and manga — view them together or split apart",
      "trendingUp",
    ],
    [
      "milestones",
      "The big landmarks in your anime and manga journey, worth celebrating",
      "calendar",
    ],
    [
      "personalRecords",
      "Personal bests and the standout titles that earned them",
      "barChart2",
    ],
    [
      "planningBacklog",
      "Everything still sitting in your plan-to-watch and plan-to-read pile",
      "clock",
    ],
    [
      "mostRewatched",
      "The titles you keep coming back to — your most rewatched and reread",
      "activity",
    ],
    [
      "currentlyWatchingReading",
      "What's on your plate right now, with options to filter by anime or manga only",
      "clock",
    ],
    [
      "droppedMedia",
      "The ones that didn't make the cut — every title you've walked away from",
      "activity",
    ],
  ]),
  ...buildCardTypeMetadata("Advanced Analytics", [
    [
      "scoreCompareAnimeManga",
      "Do you score anime and manga the same way? This card settles the debate",
      "trendingUp",
    ],
    [
      "countryDiversity",
      "How worldly is your taste? Country diversity, anime vs manga",
      "pieChart",
    ],
    [
      "genreDiversity",
      "Genre spread across both media — are you more adventurous with one than the other?",
      "pieChart",
    ],
    [
      "formatPreferenceOverview",
      "TV vs manga proper, movies vs one-shots — your format leanings compared",
      "pieChart",
    ],
    [
      "releaseEraPreference",
      "Classic era fan or modern-day devotee? See where most of your picks land",
      "calendar",
    ],
    [
      "startYearMomentum",
      "When did you start picking up new titles? Track the momentum year by year",
      "trendingUp",
    ],
    [
      "lengthPreference",
      "Quick reads and binge-watches vs sprawling epics — see which side wins",
      "trendingUp",
    ],
    [
      "tagCategoryDistribution",
      "How your tag preferences stack up when you put anime and manga next to each other",
      "pieChart",
    ],
    [
      "tagDiversity",
      "Are your anime tags all over the map while manga stays niche? Find out",
      "pieChart",
    ],
  ]),
];

const CARD_GROUPS_BY_CARD_TYPE = new Map(
  CARD_GROUPS.map((cardGroup) => [cardGroup.cardType, cardGroup]),
);

const EXAMPLES_CARD_TYPES: ExampleCardType[] = CARD_TYPE_METADATA.map(
  (cardType) => {
    const group = CARD_GROUPS_BY_CARD_TYPE.get(cardType.id);

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

const CATEGORY_INFO = EXAMPLES_CATEGORIES.map((category) => {
  const collection = getExampleCollectionByCategory(category);
  const categoryCardTypes = EXAMPLES_CARD_TYPES.filter(
    (cardType) => cardType.category === category,
  );

  return {
    name: category,
    slug: collection.slug,
    href: buildExamplesCollectionPath(collection.slug),
    description: collection.description,
    sectionDescription: collection.sectionDescription,
    indexLabel: collection.indexLabel,
    count: categoryCardTypes.length,
    variantCount: categoryCardTypes.reduce(
      (sum, cardType) => sum + cardType.variants.length,
      0,
    ),
  };
});

const EXAMPLES_CATALOG_SUMMARY: ExamplesCatalogSummary = {
  categories: EXAMPLES_CATEGORIES,
  categoryInfo: CATEGORY_INFO,
  totalCardTypes: EXAMPLES_CARD_TYPES.length,
  totalVariants: EXAMPLES_CARD_TYPES.reduce(
    (sum, cardType) => sum + cardType.variants.length,
    0,
  ),
};

const EXAMPLES_CATALOG: ExamplesCatalogPayload = {
  ...EXAMPLES_CATALOG_SUMMARY,
  cardTypes: EXAMPLES_CARD_TYPES,
};

export function getExamplesCatalogSummary(): ExamplesCatalogSummary {
  return EXAMPLES_CATALOG_SUMMARY;
}

export function getExamplesCatalog(): ExamplesCatalogPayload {
  return EXAMPLES_CATALOG;
}

export function getExamplesCollectionCatalog(
  slug: string,
): ExamplesCatalogPayload | null {
  const collection = getExampleCollectionBySlug(slug);

  if (!collection) {
    return null;
  }

  const cardTypes = EXAMPLES_CARD_TYPES.filter(
    (cardType) => cardType.category === collection.name,
  );

  return {
    ...EXAMPLES_CATALOG_SUMMARY,
    cardTypes,
    totalCardTypes: cardTypes.length,
    totalVariants: cardTypes.reduce(
      (sum, cardType) => sum + cardType.variants.length,
      0,
    ),
  };
}
