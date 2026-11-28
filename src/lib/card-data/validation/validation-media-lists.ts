/**
 * Normalization of the media lists and stored aggregate totals on a user record.
 *
 * `mapMediaListEntry` turns one stored list entry into the shape the card
 * templates read. `normalizeMediaListCollection` collapses a multi-list
 * collection into a single alphabetical "All" list. The `normalizeStored*`
 * readers clean totals written by an earlier run so a record keeps its own
 * aggregates instead of recomputing them.
 *
 * @source
 */

import type {
  MediaListCollection,
  MediaListEntry,
  ReviewEntry,
  RecommendationEntry,
  UserReviewsPage,
  UserRecommendationsPage,
  SourceMaterialDistributionTotalsEntry,
  SeasonalPreferenceTotalsEntry,
  AnimeGenreSynergyTotalsEntry,
  StudioCollaborationTotalsEntry,
} from "@/lib/types/records";

import {
  coerceNumber,
  getNestedString,
  isObject,
} from "./validation-primitives";

// Media list entries
export const mapMediaListEntry = (e: unknown): MediaListEntry | null => {
  if (!e || typeof e !== "object") return null;
  const r = e as Record<string, unknown>;
  const media = (r.media as Record<string, unknown> | undefined) ?? {};
  const _coverLarge = getNestedString(media, ["coverImage", "large"]);
  const _coverMedium = getNestedString(media, ["coverImage", "medium"]);
  const _coverColor = getNestedString(media, ["coverImage", "color"]);
  const coverImage =
    _coverLarge || _coverMedium || _coverColor
      ? {
          large: _coverLarge || undefined,
          medium: _coverMedium || undefined,
          color: _coverColor || undefined,
        }
      : undefined;

  const rawGenres = media["genres"];
  const genres = Array.isArray(rawGenres)
    ? rawGenres
        .filter((g): g is string => typeof g === "string")
        .map((g) => g.trim())
        .filter((g) => g.length > 0)
    : undefined;

  const rawStudiosNodes = (media as { studios?: { nodes?: unknown } }).studios
    ?.nodes;
  const studios = Array.isArray(rawStudiosNodes)
    ? rawStudiosNodes
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rec = s as Record<string, unknown>;
          const id = coerceNumber(rec.id);
          const name = typeof rec.name === "string" ? rec.name.trim() : "";
          if (!Number.isFinite(id) || !name) return null;
          return { id, name };
        })
        .filter((x): x is { id: number; name: string } => x !== null)
    : undefined;

  return {
    id: coerceNumber(r.id, 0) ?? 0,
    score: coerceNumber(r.score),
    progress: coerceNumber(r.progress),
    repeat: coerceNumber(r.repeat),
    media: {
      id: coerceNumber(media?.id, 0) ?? 0,
      title: {
        english: getNestedString(media, ["title", "english"]),
        romaji: getNestedString(media, ["title", "romaji"]),
        native: getNestedString(media, ["title", "native"]),
      },
      ...(coverImage ? { coverImage } : {}),
      episodes: coerceNumber(media?.episodes),
      chapters: coerceNumber(media?.chapters),
      volumes: coerceNumber(media?.volumes),
      averageScore: coerceNumber(media?.averageScore),
      format: getNestedString(media, ["format"]) || undefined,
      source: getNestedString(media, ["source"]) || undefined,
      season: getNestedString(media, ["season"]) || undefined,
      seasonYear: coerceNumber(media?.seasonYear),
      ...(studios?.length ? { studios: { nodes: studios } } : {}),
      ...(genres?.length ? { genres } : {}),
    },
  } as MediaListEntry;
};

export const mapReviewEntry = (raw: unknown): ReviewEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const media = (rec.media as Record<string, unknown> | undefined) ?? {};

  const rawGenres = media.genres;
  const genres = Array.isArray(rawGenres)
    ? rawGenres
        .filter((g): g is string => typeof g === "string")
        .map((g) => g.trim())
        .filter((g) => g.length > 0)
    : undefined;

  const summary =
    typeof rec.summary === "string"
      ? rec.summary.trim().slice(0, 500)
      : undefined;

  return {
    id: coerceNumber(rec.id, 0) ?? 0,
    score: coerceNumber(rec.score, 0) ?? 0,
    rating: coerceNumber(rec.rating, 0) ?? 0,
    ratingAmount: coerceNumber(rec.ratingAmount, 0) ?? 0,
    summary: summary || undefined,
    createdAt: coerceNumber(rec.createdAt),
    media: {
      id: coerceNumber(media.id, 0) ?? 0,
      title: {
        romaji: getNestedString(media, ["title", "romaji"]) || undefined,
      },
      type: getNestedString(media, ["type"]) || undefined,
      ...(genres?.length ? { genres } : {}),
    },
  };
};

export const normalizeUserReviewsPage = (
  raw: unknown,
): UserReviewsPage | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const rawReviews = Array.isArray(rec.reviews) ? rec.reviews : [];
  const reviews = rawReviews
    .map(mapReviewEntry)
    .filter((x): x is ReviewEntry => x !== null)
    .slice(0, 50);
  return reviews.length ? { reviews } : undefined;
};

export const mapRecommendationEntry = (
  raw: unknown,
): RecommendationEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const media = (rec.media as Record<string, unknown> | undefined) ?? {};
  const mediaRecommendation =
    (rec.mediaRecommendation as Record<string, unknown> | undefined) ?? {};

  return {
    id: coerceNumber(rec.id, 0) ?? 0,
    rating: coerceNumber(rec.rating, 0) ?? 0,
    media: {
      id: coerceNumber(media.id, 0) ?? 0,
      title: {
        romaji: getNestedString(media, ["title", "romaji"]) || undefined,
      },
    },
    mediaRecommendation: {
      id: coerceNumber(mediaRecommendation.id, 0) ?? 0,
      title: {
        romaji:
          getNestedString(mediaRecommendation, ["title", "romaji"]) ||
          undefined,
      },
    },
  };
};

export const normalizeUserRecommendationsPage = (
  raw: unknown,
): UserRecommendationsPage | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const rawRecs = Array.isArray(rec.recommendations) ? rec.recommendations : [];
  const recommendations = rawRecs
    .map(mapRecommendationEntry)
    .filter((x): x is RecommendationEntry => x !== null)
    .slice(0, 25);
  return recommendations.length ? { recommendations } : undefined;
};

// Media list collections
export const normalizeMediaListCollection = (
  raw: unknown,
): MediaListCollection | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  if (!Array.isArray(v.lists)) return undefined;

  const allEntriesRaw: MediaListEntry[] = (v.lists as unknown[])
    .flatMap((list) => {
      const rec =
        list && typeof list === "object"
          ? (list as Record<string, unknown>)
          : {};
      return Array.isArray(rec.entries) ? rec.entries : [];
    })
    .map(mapMediaListEntry)
    .filter((x): x is MediaListEntry => x !== null);

  const rank = (e: MediaListEntry): readonly [number, number, number] => [
    e.repeat ?? 0,
    e.score ?? 0,
    e.progress ?? 0,
  ];
  const isBetter = (current: MediaListEntry, next: MediaListEntry): boolean => {
    const a = rank(current);
    const b = rank(next);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return b[i] > a[i];
    }
    return false;
  };

  const byMediaId = new Map<number, MediaListEntry>();
  for (const entry of allEntriesRaw) {
    const mediaId = entry.media?.id;
    if (!mediaId) continue;
    const existing = byMediaId.get(mediaId);
    if (!existing || isBetter(existing, entry)) byMediaId.set(mediaId, entry);
  }

  const allEntries = [...byMediaId.values()];

  const rawCount = coerceNumber(v.count);
  const totalCount = rawCount ?? allEntries.length;

  const rawTotalRepeat = coerceNumber(v.totalRepeat);
  const computedTotalRepeat = allEntries.reduce(
    (sum, e) => sum + (e.repeat ?? 0),
    0,
  );
  const totalRepeat = rawTotalRepeat ?? computedTotalRepeat;

  return {
    lists: [{ name: "All", entries: allEntries }],
    count: totalCount,
    totalRepeat,
  };
};

export const isPrunedAllList = (raw: unknown): boolean =>
  !!raw &&
  typeof raw === "object" &&
  Array.isArray((raw as { lists?: unknown }).lists) &&
  (raw as { lists: { name?: string }[] }).lists.length === 1 &&
  (raw as { lists: { name?: string }[] }).lists[0].name === "All";

export const pruneIfNeeded = (
  raw: unknown,
  coll: MediaListCollection | undefined,
  pruner: (entries: MediaListEntry[]) => MediaListEntry[],
): MediaListCollection | undefined => {
  if (!coll) return undefined;
  if (isPrunedAllList(raw)) return coll;
  const entries = coll.lists.flatMap((l) => l.entries);
  const pruned = pruner(entries);
  return { ...coll, lists: [{ name: "All", entries: pruned }] };
};

// Stored aggregate totals
export const normalizeStoredSourceTotals = (
  value: unknown,
): SourceMaterialDistributionTotalsEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const source = typeof rec.source === "string" ? rec.source : "";
      const count =
        typeof rec.count === "number" && Number.isFinite(rec.count)
          ? rec.count
          : Number.NaN;
      if (!source.trim() || !Number.isFinite(count) || count <= 0) return null;
      return { source: source.trim(), count };
    })
    .filter((x): x is SourceMaterialDistributionTotalsEntry => x !== null);

  return normalized.length ? normalized : undefined;
};

export const normalizeStoredSeasonTotals = (
  value: unknown,
): SeasonalPreferenceTotalsEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const season = typeof rec.season === "string" ? rec.season : "";
      const count =
        typeof rec.count === "number" && Number.isFinite(rec.count)
          ? rec.count
          : Number.NaN;
      if (!season.trim() || !Number.isFinite(count) || count <= 0) return null;
      return { season: season.trim(), count };
    })
    .filter((x): x is SeasonalPreferenceTotalsEntry => x !== null);

  return normalized.length ? normalized : undefined;
};

export const normalizeStoredGenreSynergyTotals = (
  value: unknown,
): AnimeGenreSynergyTotalsEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const a = typeof rec.a === "string" ? rec.a.trim() : "";
      const b = typeof rec.b === "string" ? rec.b.trim() : "";
      const count =
        typeof rec.count === "number" && Number.isFinite(rec.count)
          ? rec.count
          : Number.NaN;

      if (!a || !b || a === b || !Number.isFinite(count) || count <= 0) {
        return null;
      }

      // Canonicalize ordering so stored data stays consistent.
      const [left, right] = a.localeCompare(b) <= 0 ? [a, b] : [b, a];
      return {
        a: left,
        b: right,
        count,
      } satisfies AnimeGenreSynergyTotalsEntry;
    })
    .filter((x): x is AnimeGenreSynergyTotalsEntry => x !== null);

  if (!normalized.length) return undefined;

  // Deduplicate by pair, keeping the max count just in case.
  const byKey = new Map<string, AnimeGenreSynergyTotalsEntry>();
  for (const item of normalized) {
    const key = `${item.a}|||${item.b}`;
    const existing = byKey.get(key);
    if (!existing || item.count > existing.count) byKey.set(key, item);
  }
  return [...byKey.values()];
};

/**
 * Normalize stored studio collaboration totals from the database.
 * Each entry has two studio names (a, b) and a count of co-productions.
 */
export const normalizeStoredStudioCollaborationTotals = (
  value: unknown,
): StudioCollaborationTotalsEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const a = typeof rec.a === "string" ? rec.a.trim() : "";
      const b = typeof rec.b === "string" ? rec.b.trim() : "";
      const count =
        typeof rec.count === "number" && Number.isFinite(rec.count)
          ? rec.count
          : Number.NaN;

      if (!a || !b || a === b || !Number.isFinite(count) || count <= 0) {
        return null;
      }

      // Canonicalize ordering so stored data stays consistent.
      const [left, right] = a.localeCompare(b) <= 0 ? [a, b] : [b, a];
      return {
        a: left,
        b: right,
        count,
      } satisfies StudioCollaborationTotalsEntry;
    })
    .filter((x): x is StudioCollaborationTotalsEntry => x !== null);

  if (!normalized.length) return undefined;

  // Deduplicate by pair, keeping the max count.
  const byKey = new Map<string, StudioCollaborationTotalsEntry>();
  for (const item of normalized) {
    const key = `${item.a}|||${item.b}`;
    const existing = byKey.get(key);
    if (!existing || item.count > existing.count) byKey.set(key, item);
  }
  return [...byKey.values()];
};
