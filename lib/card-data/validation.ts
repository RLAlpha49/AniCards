/**
 * What a stored user record is, and the names the UI prints for a card type.
 *
 * `validateAndNormalizeUserRecord` is the only reader of an untrusted record:
 * it checks the record has statistics, runs each stage over the part it owns,
 * and returns either the normalized record or an error with a status. The stages
 * live beside this file so a rule about one part of the record can be read and
 * tested without loading the other 1,200 lines.
 *
 * @source
 */

import type {
  UserRecord,
  UserStatsData,
  StoredAnimeStats,
  StoredMangaStats,
  UserAvatar,
} from "@/lib/types/records";
import type { ErrorCategory, RecoverySuggestion } from "@/lib/error-messages";
import { getErrorDetails } from "@/lib/error-messages";
import { isValidTimestamp } from "@/lib/card-version";
import { CARD_REGISTRY, hasCardId } from "@/lib/cards/registry";

import { isObject, normalizePage } from "./validation-primitives";
import { normalizeStatBlock } from "./validation-stats";
import {
  combineUnique,
  collectFavouriteNodes,
  mapFavouriteMediaNode,
  mapFavouritePersonNode,
  mapFavouriteStudioNode,
} from "./validation-favourites";
import {
  normalizeMediaListCollection,
  normalizeUserRecommendationsPage,
  normalizeUserReviewsPage,
  normalizeStoredGenreSynergyTotals,
  normalizeStoredSeasonTotals,
  normalizeStoredSourceTotals,
  normalizeStoredStudioCollaborationTotals,
  pruneIfNeeded,
} from "./validation-media-lists";
import {
  computeAnimeGenreSynergyTotals,
  computeAnimeSeasonalPreferenceTotals,
  computeAnimeSourceMaterialDistributionTotals,
  computeStudioCollaborationTotals,
} from "./validation-aggregates";

/**
 * Error wrapper including an HTTP status code, error category, and recovery suggestions.
 * Useful for returning standardized errors from card-related handlers with user guidance.
 *
 * The `category`, `suggestions`, and `retryable` properties are automatically derived from
 * the error message and status code, enabling consistent error handling across the application.
 *
 * These properties are primarily used for:
 * - Error tracking and telemetry (logged via trackUserActionError in API routes)
 * - Client-side error display logic (determining retry behavior)
 * - Future expansion to include structured suggestion data in API responses
 *
 * @source
 */
export class CardDataError extends Error {
  status: number;
  category: ErrorCategory;
  suggestions: RecoverySuggestion[];
  retryable: boolean;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;

    // Categorize and get details from error message system
    const errorDetails = getErrorDetails(message, status);
    this.category = errorDetails.category;
    this.suggestions = errorDetails.suggestions;
    this.retryable = errorDetails.retryable;
  }
}

/** Representation of a genre and its count for a user's media statistics. @source */
export type GenreItem = { genre: string; count: number };
/** Tag item (name + count) used in tag distribution lists. @source */
export type TagItem = {
  tag: { name: string; category?: string };
  count: number;
};
/** Voice actor item with full name and count (for anime voice actor stats). @source */
export type VoiceActorItem = {
  voiceActor: { name: { full: string } };
  count: number;
};
/** Studio item (name + count) used for studio distribution lists. @source */
export type StudioItem = { studio: { name: string }; count: number };
/** Staff item with full name and count (for anime or manga staff stats). @source */
export type StaffItem = { staff: { name: { full: string } }; count: number };

/**
 * Short display labels for each card type, derived from the card registry.
 * Used when rendering card labels or titles in the UI and templates.
 * @source
 */
export const displayNames: Record<string, string> = Object.fromEntries(
  CARD_REGISTRY.map((card) => [card.id, card.label]),
);

/**
 * Returns whether the provided card type string corresponds to a supported
 * base card type. Accepts values with optional suffix variants (e.g.
 * "animeStats-vertical") and validates against the server-known
 * `displayNames` mapping.
 * @param candidate - Card type string to validate.
 * @returns true when the base card type is supported, false otherwise.
 */
export function isValidCardType(candidate: unknown): boolean {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return false;
  }
  const [base] = candidate.split("-");
  return hasCardId(base);
}

/**
 * Extracts favourite names from a user's favourites block for a card base type.
 * Supports staff, studios, and character favorites for voice actor cards.
 * @param favoritesData - The raw favourites object from an Anilist user record.
 * @param baseCardType - The base card identifier (e.g. "animeVoiceActors").
 * @returns Array of favourite names relevant to the card type.
 * @source
 */
export function getFavoritesForCardType(
  favoritesData: unknown,
  baseCardType: string,
): string[] {
  if (!favoritesData || typeof favoritesData !== "object") return [];
  const fav = favoritesData as {
    staff?: { nodes: { name: { full: string } }[] };
    studios?: { nodes: { name: string }[] };
    characters?: { nodes: { name: { full: string } }[] };
  };
  switch (baseCardType) {
    case "animeVoiceActors":
      return fav.characters?.nodes?.map((c) => c.name.full) ?? [];
    case "animeStudios":
      return fav.studios?.nodes?.map((s) => s.name) ?? [];
    case "animeStaff":
    case "mangaStaff":
      return fav.staff?.nodes?.map((s) => s.name.full) ?? [];
    default:
      return [];
  }
}
/**
 * Validates and normalizes a raw user record into the shape the rest of the
 * app reads.
 *
 * @param raw - Record read from Redis or built by a script.
 * @param options - `recomputeAggregates` recomputes the aggregate totals from
 *   the media lists instead of keeping the totals already stored on the record.
 * @returns The normalized record, or an error and optional status.
 * @source
 */
export function validateAndNormalizeUserRecord(
  raw: unknown,
  options: { recomputeAggregates?: boolean } = {},
): { normalized: UserRecord } | { error: string; status?: number } {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid user record: not an object" };
  }

  const user = raw as Partial<UserRecord>;

  if (!user.stats || typeof user.stats !== "object") {
    return { error: "Invalid user record: missing statistics" };
  }

  const statsData = user.stats as Partial<UserStatsData>;

  const rawActivityHistory = statsData?.User?.stats?.activityHistory;
  const normalizedActivityHistory = Array.isArray(rawActivityHistory)
    ? rawActivityHistory
        .map((a: unknown) => {
          const item = a as { date?: unknown; amount?: unknown };
          const date = Number(item?.date ?? Number.NaN);
          const amount = Number(item?.amount ?? Number.NaN);
          return {
            date: Number.isFinite(date) ? date : 0,
            amount: Number.isFinite(amount) ? amount : 0,
          };
        })
        .filter((entry) => {
          const oneYearAgo = Math.floor(Date.now() / 1000) - 31536000;
          return entry.date >= oneYearAgo;
        })
    : [];

  const favouriteNodes = collectFavouriteNodes(
    statsData.User?.favourites as
      Record<string, { nodes?: unknown }> | undefined,
  );

  /**
   * Stored totals survive unless a caller asks for a recomputation, which is
   * what a refresh does after new list data arrives.
   * @source
   */
  const storedAggregatesCandidate = (user as Record<string, unknown>)
    .aggregates;
  const storedAggregates =
    !options.recomputeAggregates && isObject(storedAggregatesCandidate)
      ? storedAggregatesCandidate
      : undefined;

  const completedRaw = statsData.animeCompleted;
  const currentRaw = statsData.animeCurrent;

  const storedAnimeSourceTotals =
    normalizeStoredSourceTotals(
      storedAggregates?.animeSourceMaterialDistributionTotals,
    ) ?? computeAnimeSourceMaterialDistributionTotals(completedRaw, currentRaw);
  const storedAnimeSeasonTotals =
    normalizeStoredSeasonTotals(
      storedAggregates?.animeSeasonalPreferenceTotals,
    ) ?? computeAnimeSeasonalPreferenceTotals(completedRaw, currentRaw);
  const storedAnimeGenreSynergyTotals =
    normalizeStoredGenreSynergyTotals(
      storedAggregates?.animeGenreSynergyTotals,
    ) ?? computeAnimeGenreSynergyTotals(completedRaw);
  const storedStudioCollaborationTotals =
    normalizeStoredStudioCollaborationTotals(
      storedAggregates?.studioCollaborationTotals,
    ) ?? computeStudioCollaborationTotals(completedRaw);

  const buildAggregates = (): Record<string, unknown> => {
    const aggregates: Record<string, unknown> = {};
    const totals: [string, unknown][] = [
      ["animeSourceMaterialDistributionTotals", storedAnimeSourceTotals],
      ["animeSeasonalPreferenceTotals", storedAnimeSeasonTotals],
      ["animeGenreSynergyTotals", storedAnimeGenreSynergyTotals],
      ["studioCollaborationTotals", storedStudioCollaborationTotals],
    ];
    for (const [key, value] of totals) {
      if (Array.isArray(value) && value.length) aggregates[key] = value;
    }
    return aggregates;
  };

  const aggregatesObj = buildAggregates();

  const normalizedUser: UserRecord = {
    userId: String(user.userId ?? ""),
    username: user.username ?? undefined,
    createdAt: String(user.createdAt ?? new Date().toISOString()),
    updatedAt: String(user.updatedAt ?? new Date().toISOString()),
    // A version that is not a readable timestamp is dropped rather than
    // stored. It could not be compared with another version, so a card URL
    // built from it would never move again.
    ...(isValidTimestamp(user.dataUpdatedAt)
      ? { dataUpdatedAt: user.dataUpdatedAt as string }
      : {}),
    ...(Object.keys(aggregatesObj).length ? { aggregates: aggregatesObj } : {}),
    stats: {
      followersPage: normalizePage(statsData.followersPage, {
        itemsKey: "followers",
      }),
      followingPage: normalizePage(statsData.followingPage, {
        itemsKey: "following",
      }),
      threadsPage: normalizePage(statsData.threadsPage, {
        itemsKey: "threads",
      }),
      threadCommentsPage: normalizePage(statsData.threadCommentsPage, {
        itemsKey: "threadComments",
      }),
      reviewsPage: normalizePage(statsData.reviewsPage, {
        itemsKey: "reviews",
      }),
      userReviews: normalizeUserReviewsPage(statsData.userReviews),
      userRecommendations: normalizeUserRecommendationsPage(
        statsData.userRecommendations,
      ),
      // We limit the entries saved to the database to only what's needed for the cards
      animePlanning: (() => {
        const raw = statsData.animePlanning;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort(
              (a, b) =>
                (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0),
            )
            .slice(0, 5),
        );
      })(),
      mangaPlanning: (() => {
        const raw = statsData.mangaPlanning;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort(
              (a, b) =>
                (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0),
            )
            .slice(0, 5),
        );
      })(),
      animeCurrent: (() => {
        const raw = statsData.animeCurrent;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          // Keep most recent items as returned by the AniList sort (UPDATED_TIME_DESC)
          entries.slice(0, 6),
        );
      })(),
      mangaCurrent: (() => {
        const raw = statsData.mangaCurrent;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => entries.slice(0, 6));
      })(),
      animeRewatched: (() => {
        const raw = statsData.animeRewatched;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
            .slice(0, 10),
        );
      })(),
      mangaReread: (() => {
        const raw = statsData.mangaReread;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
            .slice(0, 10),
        );
      })(),
      animeCompleted: (() => {
        const raw = statsData.animeCompleted;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => {
          const topByScore = [...entries]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 5);
          const topByLength = [...entries]
            .sort((a, b) => (b.media.episodes ?? 0) - (a.media.episodes ?? 0))
            .slice(0, 5);
          return combineUnique(topByScore, topByLength);
        });
      })(),
      mangaCompleted: (() => {
        const raw = statsData.mangaCompleted;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => {
          const topByScore = [...entries]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 5);
          const topByLength = [...entries]
            .sort((a, b) => (b.media.chapters ?? 0) - (a.media.chapters ?? 0))
            .slice(0, 5);
          return combineUnique(topByScore, topByLength);
        });
      })(),
      animeDropped: (() => {
        const raw = statsData.animeDropped;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          // Keep most recent items as returned by the AniList sort (UPDATED_TIME_DESC)
          entries.slice(0, 30),
        );
      })(),
      mangaDropped: (() => {
        const raw = statsData.mangaDropped;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => entries.slice(0, 30));
      })(),
      User: {
        stats: {
          activityHistory: normalizedActivityHistory,
        },
        favourites: {
          anime: { nodes: favouriteNodes.anime.map(mapFavouriteMediaNode) },
          manga: { nodes: favouriteNodes.manga.map(mapFavouriteMediaNode) },
          staff: { nodes: favouriteNodes.staff.map(mapFavouritePersonNode) },
          studios: {
            nodes: favouriteNodes.studios.map(mapFavouriteStudioNode),
          },
          characters: {
            nodes: favouriteNodes.characters.map(mapFavouritePersonNode),
          },
        },
        statistics: {
          anime: normalizeStatBlock(
            statsData.User?.statistics?.anime,
            "anime",
          ) as StoredAnimeStats | undefined,
          manga: normalizeStatBlock(
            statsData.User?.statistics?.manga,
            "manga",
          ) as StoredMangaStats | undefined,
        },
        avatar: (() => {
          const rawAvatar = statsData.User?.avatar;
          if (
            rawAvatar &&
            typeof rawAvatar === "object" &&
            (typeof (rawAvatar as Record<string, unknown>).large === "string" ||
              typeof (rawAvatar as Record<string, unknown>).medium === "string")
          ) {
            const av = rawAvatar as Record<string, unknown>;
            return {
              large: typeof av.large === "string" ? av.large : undefined,
              medium: typeof av.medium === "string" ? av.medium : undefined,
            } as UserAvatar;
          }
          return undefined;
        })(),
        createdAt: (() => {
          const rawCreatedAt = statsData.User?.createdAt;
          if (typeof rawCreatedAt === "number") return rawCreatedAt;
          if (typeof rawCreatedAt === "string") {
            const parsed = Number.parseInt(rawCreatedAt, 10);
            return Number.isFinite(parsed) ? parsed : undefined;
          }
          return undefined;
        })(),
      },
    } as unknown as UserStatsData,
  };

  if (
    !normalizedUser.stats.User.statistics.anime &&
    !normalizedUser.stats.User.statistics.manga
  ) {
    return {
      error: "Missing statistics: no anime or manga stats present",
      status: 404,
    };
  }

  return { normalized: normalizedUser };
}

/** Fields representing milestone progress used by card templates. @source */
export type MilestoneFields = {
  previousMilestone: number;
  currentMilestone: number;
  percentage: number;
  dasharray: string;
  dashoffset: string;
};
