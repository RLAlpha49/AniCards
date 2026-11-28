/**
 * Normalization of one stored anime or manga statistics block.
 *
 * Every list the card templates read (genres, tags, voice actors, studios,
 * staff, statuses, formats, scores, years, lengths) is rebuilt here from an
 * untrusted record, with invalid entries dropped and each list capped.
 *
 * @source
 */

import type {
  StoredAnimeStats,
  StoredMangaStats,
  AnimeStatVoiceActor,
  AnimeStatStudio,
  AnimeStatStaff,
  MangaStatStaff,
} from "@/lib/types/records";

import { coerceNumber, getNestedString } from "./validation-primitives";

/**
 * Normalizes an anime or manga stats block.
 * It coerces numeric values, maps nested arrays (genres, tags, staff, etc.), and filters invalid entries.
 * Returns a structured partial StoredAnimeStats|StoredMangaStats or undefined for invalid blocks.
 * @param rawStatBlock - Raw statistics block from the user record.
 * @param type - Either 'anime' or 'manga' to include type-specific fields.
 * @returns A normalized stats block or undefined.
 * @source
 */
export const normalizeStatBlock = (
  rawStatBlock: unknown,
  type: "anime" | "manga",
) => {
  if (!rawStatBlock || typeof rawStatBlock !== "object") return undefined;
  const block = rawStatBlock as Record<string, unknown>;

  const rawGenres = block["genres"];
  const genres = Array.isArray(rawGenres)
    ? (rawGenres as unknown[])
        .map((g) => {
          if (!g || typeof g !== "object") return null;
          const rec = g as Record<string, unknown>;
          return {
            genre:
              typeof rec.genre === "string"
                ? rec.genre
                : String(rec.genre ?? ""),
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (g): g is { genre: string; count: number } => !!g && g.genre !== "",
        )
        .slice(0, 25)
    : [];
  const rawTags = block["tags"];
  const tags = Array.isArray(rawTags)
    ? (rawTags as unknown[])
        .map((t) => {
          if (!t || typeof t !== "object") return null;
          const rec = t as Record<string, unknown>;
          const tagName = getNestedString(rec, ["tag", "name"]);
          const tagCategory = getNestedString(rec, ["tag", "category"]);
          return {
            tag: {
              name: tagName,
              ...(tagCategory ? { category: tagCategory } : {}),
            },
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (
            t,
          ): t is {
            tag: { name: string; category?: string };
            count: number;
          } => !!t && !!t.tag && !!t.tag.name,
        )
        .slice(0, 25)
    : [];
  const rawVoiceActors = block["voiceActors"];
  const voiceActors: AnimeStatVoiceActor[] = Array.isArray(rawVoiceActors)
    ? (rawVoiceActors as unknown[])
        .map((v) => {
          if (!v || typeof v !== "object") return null;
          const rec = v as Record<string, unknown>;
          const fullName = getNestedString(rec, ["voiceActor", "name", "full"]);
          return {
            voiceActor: { name: { full: fullName } },
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (v): v is AnimeStatVoiceActor =>
            getNestedString(v, ["voiceActor", "name", "full"]) !== "",
        )
        .slice(0, 25)
    : [];
  const rawStudios = block["studios"];
  const studios: AnimeStatStudio[] = Array.isArray(rawStudios)
    ? (rawStudios as unknown[])
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rec = s as Record<string, unknown>;
          const studioName = getNestedString(rec, ["studio", "name"]);
          return {
            studio: { name: studioName },
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (s): s is AnimeStatStudio =>
            getNestedString(s, ["studio", "name"]) !== "",
        )
        .slice(0, 25)
    : [];
  const rawStaff = block["staff"];
  const staff: AnimeStatStaff[] | MangaStatStaff[] = Array.isArray(rawStaff)
    ? (rawStaff as unknown[])
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rec = s as Record<string, unknown>;
          const staffName = getNestedString(rec, ["staff", "name", "full"]);
          return {
            staff: { name: { full: staffName } },
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (s): s is AnimeStatStaff | MangaStatStaff =>
            getNestedString(s, ["staff", "name", "full"]) !== "",
        )
        .slice(0, 25)
    : [];
  const rawStatuses = block["statuses"];
  const statuses = Array.isArray(rawStatuses)
    ? (rawStatuses as unknown[])
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rec = s as Record<string, unknown>;
          return {
            status: String(rec.status ?? ""),
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (s): s is { status: string; count: number } => !!s && !!s.status,
        )
    : undefined;
  const rawFormats = block["formats"];
  const formats = Array.isArray(rawFormats)
    ? (rawFormats as unknown[])
        .map((f) => {
          if (!f || typeof f !== "object") return null;
          const rec = f as Record<string, unknown>;
          return {
            format: String(rec.format ?? ""),
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (f): f is { format: string; count: number } => !!f && !!f.format,
        )
    : undefined;
  const rawScores = block["scores"];
  const scores = Array.isArray(rawScores)
    ? (rawScores as unknown[])
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rec = s as Record<string, unknown>;
          return {
            score: coerceNumber(rec.score, Number.NaN),
            count: coerceNumber(rec.count, 0),
          };
        })
        .filter(
          (s): s is { score: number; count: number } =>
            s !== null && Number.isFinite(s.score),
        )
    : undefined;
  const rawReleaseYears = block["releaseYears"];
  const releaseYears = Array.isArray(rawReleaseYears)
    ? (rawReleaseYears as unknown[])
        .map((r) => {
          if (!r || typeof r !== "object") return null;
          const rec = r as Record<string, unknown>;
          return {
            releaseYear: coerceNumber(rec.releaseYear, Number.NaN),
            count: coerceNumber(rec.count, 0),
          };
        })
        .filter(
          (r): r is { releaseYear: number; count: number } =>
            r !== null && Number.isFinite(r.releaseYear),
        )
    : undefined;
  const rawCountries = block["countries"];
  const countries = Array.isArray(rawCountries)
    ? (rawCountries as unknown[])
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const rec = c as Record<string, unknown>;
          return {
            country: String(rec.country ?? ""),
            count: coerceNumber(rec.count, 0) ?? 0,
          };
        })
        .filter(
          (c): c is { country: string; count: number } => !!c && !!c.country,
        )
    : undefined;

  const rawStartYears = block["startYears"];
  const startYears = Array.isArray(rawStartYears)
    ? (rawStartYears as unknown[])
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rec = s as Record<string, unknown>;
          return {
            startYear: coerceNumber(rec.startYear, Number.NaN),
            count: coerceNumber(rec.count, 0),
          };
        })
        .filter(
          (s): s is { startYear: number; count: number } =>
            s !== null &&
            Number.isFinite(s.startYear) &&
            typeof s.count === "number" &&
            Number.isFinite(s.count),
        )
    : undefined;

  const rawLengths = block["lengths"];
  const lengths = Array.isArray(rawLengths)
    ? (rawLengths as unknown[])
        .map((l) => {
          if (!l || typeof l !== "object") return null;
          const rec = l as Record<string, unknown>;
          const length = String(rec.length ?? "").trim();
          return {
            length,
            count: coerceNumber(rec.count, 0),
          };
        })
        .filter(
          (l): l is { length: string; count: number } =>
            l !== null &&
            l.length !== "" &&
            typeof l.count === "number" &&
            Number.isFinite(l.count),
        )
    : undefined;

  const count = coerceNumber(block.count);
  const meanScore = coerceNumber(block.meanScore);
  const standardDeviation = coerceNumber(block.standardDeviation);

  const normalizedBlock: Partial<StoredAnimeStats & StoredMangaStats> = {
    count,
    meanScore,
    standardDeviation,
    genres,
    tags,
    voiceActors,
    studios,
    staff,
    statuses,
    formats,
    scores,
    releaseYears,
    countries,
    startYears,
    lengths,
  };

  if (type === "anime") {
    normalizedBlock.episodesWatched = coerceNumber(block.episodesWatched);
    normalizedBlock.minutesWatched = coerceNumber(block.minutesWatched);
  }
  if (type === "manga") {
    normalizedBlock.chaptersRead = coerceNumber(block.chaptersRead);
    normalizedBlock.volumesRead = coerceNumber(block.volumesRead);
  }

  return normalizedBlock;
}; // normalizeStatBlock
