/**
 * Pre-aggregated totals computed from a user's completed and current anime lists.
 *
 * Each reader takes the raw stored lists rather than the statistics block, so it
 * works the same on a record read from Redis and on a fixture. They run over the
 * full CURRENT and COMPLETED lists, before anything is pruned for storage.
 *
 * @source
 */

import type {
  MediaListEntry,
  SourceMaterialDistributionTotalsEntry,
  SeasonalPreferenceTotalsEntry,
  AnimeGenreSynergyTotalsEntry,
  StudioCollaborationTotalsEntry,
} from "@/lib/types/records";

import { normalizeMediaListCollection } from "./validation-media-lists";

/**
 * Compute pre-aggregated totals for Source Material Distribution.
 *
 * IMPORTANT: This uses the *full* CURRENT + COMPLETED lists as returned by AniList
 * (after normalization), before we prune what gets persisted to Redis.
 */
export const computeAnimeSourceMaterialDistributionTotals = (
  completedRaw: unknown,
  currentRaw?: unknown,
): SourceMaterialDistributionTotalsEntry[] | undefined => {
  const completedFull = normalizeMediaListCollection(completedRaw);
  const currentFull = normalizeMediaListCollection(currentRaw);

  const completedEntries = completedFull?.lists.flatMap((l) => l.entries) ?? [];
  const currentEntries = currentFull?.lists.flatMap((l) => l.entries) ?? [];
  const all = [...completedEntries, ...currentEntries];
  if (!all.length) return undefined;

  const uniqueByMediaId = new Map<number, MediaListEntry>();
  for (const entry of all) {
    const mediaId = entry.media?.id;
    if (!mediaId) continue;
    if (!uniqueByMediaId.has(mediaId)) uniqueByMediaId.set(mediaId, entry);
  }

  const counts = new Map<string, number>();
  for (const entry of uniqueByMediaId.values()) {
    const source = (entry.media.source ?? "UNKNOWN").trim() || "UNKNOWN";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
};

/**
 * Compute pre-aggregated totals for the Anime Seasonal Preference card.
 *
 * IMPORTANT: This uses the *full* CURRENT + COMPLETED lists as returned by AniList
 * (after normalization), before we prune what gets persisted to Redis.
 */
export const computeAnimeSeasonalPreferenceTotals = (
  completedRaw: unknown,
  currentRaw?: unknown,
): SeasonalPreferenceTotalsEntry[] | undefined => {
  const completedFull = normalizeMediaListCollection(completedRaw);
  const currentFull = normalizeMediaListCollection(currentRaw);

  const completedEntries = completedFull?.lists.flatMap((l) => l.entries) ?? [];
  const currentEntries = currentFull?.lists.flatMap((l) => l.entries) ?? [];
  const all = [...completedEntries, ...currentEntries];
  if (!all.length) return undefined;

  const uniqueByMediaId = new Map<number, MediaListEntry>();
  for (const entry of all) {
    const mediaId = entry.media?.id;
    if (!mediaId) continue;
    if (!uniqueByMediaId.has(mediaId)) uniqueByMediaId.set(mediaId, entry);
  }

  const normalizeSeason = (v: string | undefined): string => {
    const raw = (v ?? "").trim().toUpperCase();
    if (
      raw === "WINTER" ||
      raw === "SPRING" ||
      raw === "SUMMER" ||
      raw === "FALL"
    ) {
      return raw;
    }
    return "UNKNOWN";
  };

  const counts = new Map<string, number>();
  for (const entry of uniqueByMediaId.values()) {
    const season = normalizeSeason(entry.media.season);
    counts.set(season, (counts.get(season) ?? 0) + 1);
  }

  const order = ["WINTER", "SPRING", "SUMMER", "FALL", "UNKNOWN"];
  const items = order
    .map((season) => ({ season, count: counts.get(season) ?? 0 }))
    .filter((x) => x.count > 0);

  return items.length ? items : undefined;
};

/**
 * Compute pre-aggregated co-occurrence totals for Genre Synergy.
 *
 * IMPORTANT: This uses the *full* COMPLETED list as returned by AniList
 * (after normalization), before we prune what gets persisted to Redis.
 */
export const computeAnimeGenreSynergyTotals = (
  completedRaw: unknown,
  currentRaw?: unknown,
): AnimeGenreSynergyTotalsEntry[] | undefined => {
  const completedFull = normalizeMediaListCollection(completedRaw);
  const entries = completedFull?.lists.flatMap((l) => l.entries) ?? [];
  if (!entries.length) return undefined;

  const TOP_N = 10;
  const MAX_GENRES_PER_TITLE = 12;

  const counts = new Map<string, number>();
  for (const entry of entries) {
    const raw = entry.media?.genres ?? [];
    if (!Array.isArray(raw) || raw.length < 2) continue;

    const uniqueGenres = [...new Set(raw.map((g) => g.trim()).filter(Boolean))]
      .slice(0, MAX_GENRES_PER_TITLE)
      .sort((a, b) => a.localeCompare(b));

    if (uniqueGenres.length < 2) continue;

    for (let i = 0; i < uniqueGenres.length; i++) {
      for (let j = i + 1; j < uniqueGenres.length; j++) {
        const a = uniqueGenres[i];
        const b = uniqueGenres[j];
        const key = `${a}|||${b}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  const items: AnimeGenreSynergyTotalsEntry[] = [...counts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split("|||");
      if (!a || !b) return null;
      return { a, b, count } satisfies AnimeGenreSynergyTotalsEntry;
    })
    .filter((x): x is AnimeGenreSynergyTotalsEntry => x !== null)
    .filter((x) => x.count > 0)
    .sort(
      (x, y) =>
        y.count - x.count || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
    )
    .slice(0, TOP_N);

  return items.length ? items : undefined;
};

/**
 * Compute pre-aggregated totals for Studio Collaboration card.
 * Counts how often pairs of studios (main studios only) collaborated on completed anime.
 */
export const computeStudioCollaborationTotals = (
  completedRaw: unknown,
  currentRaw?: unknown,
): StudioCollaborationTotalsEntry[] | undefined => {
  const completedFull = normalizeMediaListCollection(completedRaw);
  const entries = completedFull?.lists.flatMap((l) => l.entries) ?? [];
  if (!entries.length) return undefined;

  const TOP_N = 10;
  const MAX_STUDIOS_PER_TITLE = 6;

  const counts = new Map<string, number>();
  for (const entry of entries) {
    const rawStudios = entry.media?.studios?.nodes ?? [];
    if (!Array.isArray(rawStudios) || rawStudios.length < 2) continue;

    const studioNames = [
      ...new Set(
        rawStudios
          .map((s) => (typeof s?.name === "string" ? s.name.trim() : ""))
          .filter(Boolean),
      ),
    ]
      .slice(0, MAX_STUDIOS_PER_TITLE)
      .sort((a, b) => a.localeCompare(b));

    if (studioNames.length < 2) continue;

    // Count all unique pairs
    for (let i = 0; i < studioNames.length; i++) {
      for (let j = i + 1; j < studioNames.length; j++) {
        const a = studioNames[i];
        const b = studioNames[j];
        const key = `${a}|||${b}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  const items: StudioCollaborationTotalsEntry[] = [...counts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split("|||");
      if (!a || !b) return null;
      return { a, b, count } satisfies StudioCollaborationTotalsEntry;
    })
    .filter((x): x is StudioCollaborationTotalsEntry => x !== null)
    .filter((x) => x.count > 0)
    .sort(
      (x, y) =>
        y.count - x.count || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
    )
    .slice(0, TOP_N);

  return items.length ? items : undefined;
};
