import type { ExampleCategory } from "@/components/examples/types";
import { trimOuterRepeatedCharacter } from "@/lib/utils";

export const EXAMPLES_INDEX_PATH = "/examples";
export const EXAMPLES_GALLERY_SEGMENT = "gallery";
export const EXAMPLES_GALLERY_PATH = `${EXAMPLES_INDEX_PATH}/${EXAMPLES_GALLERY_SEGMENT}`;
export const EXAMPLES_SEARCH_QUERY_PARAM = "search";
export const EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM = "category";

export interface ExampleCollectionDefinition {
  name: ExampleCategory;
  slug: string;
  description: string;
  sectionDescription: string;
  keywords: readonly string[];
  indexLabel: string;
}

export const EXAMPLE_COLLECTIONS = [
  {
    name: "Core Stats",
    slug: "core-stats",
    description:
      "Start with the headline cards that summarize anime, manga, social, and profile-level stats before you dive into the more obsessive breakdowns.",
    sectionDescription:
      "The essentials — a bird's-eye view of your anime and manga footprint.",
    keywords: ["headline stats", "profile summary", "overall overview"],
    indexLabel: "01",
  },
  {
    name: "Anime Deep Dive",
    slug: "anime-deep-dive",
    description:
      "Open the anime collection when you want a denser read on genres, studios, voice actors, scores, seasons, and the patterns buried in your watch history.",
    sectionDescription:
      "Granular breakdowns covering your anime genres, studios, and viewing habits.",
    keywords: ["anime breakdown", "watch history", "genre and studio analysis"],
    indexLabel: "02",
  },
  {
    name: "Manga Deep Dive",
    slug: "manga-deep-dive",
    description:
      "This collection focuses on reading habits, format splits, staff patterns, score spread, and the recurring traits that shape a manga-heavy profile.",
    sectionDescription:
      "A closer look at what you read, how you read, and which titles define your taste.",
    keywords: ["manga breakdown", "reading history", "manga analysis"],
    indexLabel: "03",
  },
  {
    name: "Activity & Engagement",
    slug: "activity-engagement",
    description:
      "Use these cards to zoom in on recency, streaks, milestones, reviews, and the pace of your public AniList activity over time.",
    sectionDescription:
      "Tracking the rhythm of your daily engagement — streaks, milestones, and peak days.",
    keywords: ["activity history", "social engagement", "review activity"],
    indexLabel: "04",
  },
  {
    name: "Library & Progress",
    slug: "library-progress",
    description:
      "These layouts surface favourites, backlog pressure, current titles, milestone moments, and the broader shape of a working library.",
    sectionDescription:
      "Your favourites, your backlog, and the milestones that matter — all in one place.",
    keywords: [
      "library progress",
      "favorites and backlog",
      "watching now",
      "reading now",
    ],
    indexLabel: "05",
  },
  {
    name: "Advanced Analytics",
    slug: "advanced-analytics",
    description:
      "When you want the comparison layer, this collection pairs anime and manga habits side by side so long-term preferences become easier to spot.",
    sectionDescription:
      "Side-by-side anime-vs-manga comparisons and the deeper patterns most people miss.",
    keywords: [
      "anime vs manga comparison",
      "cross media comparison",
      "diversity analysis",
    ],
    indexLabel: "06",
  },
] as const satisfies readonly ExampleCollectionDefinition[];

export type ExampleCollectionSlug =
  (typeof EXAMPLE_COLLECTIONS)[number]["slug"];

const EXAMPLE_COLLECTIONS_BY_NAME = new Map(
  EXAMPLE_COLLECTIONS.map((collection) => [collection.name, collection]),
);

const EXAMPLE_COLLECTIONS_BY_SLUG = new Map(
  EXAMPLE_COLLECTIONS.map((collection) => [collection.slug, collection]),
);

function normalizeSearchQuery(
  value: string | null | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
}

function slugify(value: string): string {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-");

  return trimOuterRepeatedCharacter(normalizedValue, "-");
}

function buildSearchSuffix(search?: string | null): string {
  const normalizedSearch = normalizeSearchQuery(search);

  if (!normalizedSearch) {
    return "";
  }

  const params = new URLSearchParams();
  params.set(EXAMPLES_SEARCH_QUERY_PARAM, normalizedSearch);

  return `?${params.toString()}`;
}

function buildIndexQueryString(options: {
  search?: string | null;
  category?: string | null;
}): string {
  const params = new URLSearchParams();
  const normalizedSearch = normalizeSearchQuery(options.search);
  const normalizedCategory = getExampleCollectionFromLegacyValue(
    options.category,
  )?.name;

  if (normalizedSearch) {
    params.set(EXAMPLES_SEARCH_QUERY_PARAM, normalizedSearch);
  }

  if (normalizedCategory) {
    params.set(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM, normalizedCategory);
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : "";
}

export function getExampleCollectionBySlug(
  slug: string | null | undefined,
): ExampleCollectionDefinition | null {
  const normalizedSlug = slug?.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  return (
    EXAMPLE_COLLECTIONS_BY_SLUG.get(normalizedSlug as ExampleCollectionSlug) ??
    null
  );
}

export function getExampleCollectionByCategory(
  category: ExampleCategory,
): ExampleCollectionDefinition {
  const collection = EXAMPLE_COLLECTIONS_BY_NAME.get(category);

  if (!collection) {
    throw new Error(`Unknown example collection: ${category}`);
  }

  return collection;
}

export function getExampleCollectionFromLegacyValue(
  value: string | null | undefined,
): ExampleCollectionDefinition | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return (
    getExampleCollectionBySlug(trimmedValue) ??
    EXAMPLE_COLLECTIONS_BY_NAME.get(trimmedValue as ExampleCategory) ??
    null
  );
}

export function buildExamplesGalleryPath(
  options: { search?: string | null } = {},
): string {
  return `${EXAMPLES_GALLERY_PATH}${buildSearchSuffix(options.search)}`;
}

export function buildExamplesIndexPath(
  options: { search?: string | null; category?: string | null } = {},
): string {
  return `${EXAMPLES_INDEX_PATH}${buildIndexQueryString(options)}`;
}

export function buildExamplesCollectionPath(
  slugOrCategory: string,
  options: { search?: string | null } = {},
): string {
  const collection = getExampleCollectionFromLegacyValue(slugOrCategory);
  const normalizedSlug = collection?.slug ?? slugify(slugOrCategory);

  return `${EXAMPLES_INDEX_PATH}/${normalizedSlug}${buildSearchSuffix(options.search)}`;
}

export function getExampleCardTypeAnchorId(cardTypeTitle: string): string {
  return `example-card-type-${slugify(cardTypeTitle)}`;
}
