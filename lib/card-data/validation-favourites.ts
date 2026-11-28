/**
 * Favourite nodes from a stored record, in the shape the grid and summary cards read.
 *
 * @source
 */

import type { MediaListEntry } from "@/lib/types/records";

import { coerceNumber, getNestedString } from "./validation-primitives";

/**
 * Concatenate two media list entries arrays, keeping the first entry seen for
 * each media id.
 * @param a - Entries kept as-is.
 * @param b - Entries appended when their id is not already present.
 * @returns The combined entries.
 * @source
 */
export const combineUnique = (
  a: MediaListEntry[],
  b: MediaListEntry[],
): MediaListEntry[] => {
  const combined = [...a];
  for (const e of b) {
    if (!combined.some((c) => c.id === e.id)) combined.push(e);
  }
  return combined;
};

export const mapFavouriteMediaNode = (n: unknown) => {
  const rec = n as Record<string, unknown>;
  return {
    id: coerceNumber(rec.id),
    title: {
      english: getNestedString(rec, ["title", "english"]),
      romaji: getNestedString(rec, ["title", "romaji"]),
      native: getNestedString(rec, ["title", "native"]),
    },
    coverImage: {
      large: getNestedString(rec, ["coverImage", "large"]),
      medium: getNestedString(rec, ["coverImage", "medium"]),
      color: getNestedString(rec, ["coverImage", "color"]),
    },
  };
};

export const mapFavouritePersonNode = (n: unknown) => {
  const rec = n as Record<string, unknown>;
  return {
    id: coerceNumber(rec.id),
    name: {
      full: getNestedString(rec, ["name", "full"]),
      native: getNestedString(rec, ["name", "native"]),
    },
    image: {
      large: getNestedString(rec, ["image", "large"]),
      medium: getNestedString(rec, ["image", "medium"]),
    },
  };
};

export const mapFavouriteStudioNode = (n: unknown) => {
  const rec = n as Record<string, unknown>;
  return {
    id: coerceNumber(rec.id),
    name: getNestedString(rec, ["name"]),
  };
};

export const collectFavouriteNodes = (
  favourites: Record<string, { nodes?: unknown }> | undefined,
) => {
  const nodesOf = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [];
  return {
    anime: nodesOf(favourites?.anime?.nodes),
    manga: nodesOf(favourites?.manga?.nodes),
    staff: nodesOf(favourites?.staff?.nodes),
    studios: nodesOf(favourites?.studios?.nodes),
    characters: nodesOf(favourites?.characters?.nodes),
  };
};
