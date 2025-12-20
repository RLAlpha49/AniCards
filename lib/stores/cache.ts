import { create } from "zustand";
import { devtools } from "zustand/middleware";

const APP_PREFIX = "anicards-";

/**
 * A curated list of site-specific keys that are managed by `clearAllCache`.
 * These keys are combined with the `APP_PREFIX` to form complete localStorage keys.
 */
export const VALID_CACHE_KEYS = [
  "statCardConfig",
  "statCardColors",
  "statCardTypes",
  "sidebarDefaultOpen",
  "defaultColorPreset",
  "defaultCardTypes",
  "defaultBorderEnabled",
  "defaultBorderColor",
  "savedColorConfig",
  "defaultUsername",
  "defaultVariants",
  "defaultShowFavoritesByCard",
  "useAnimeStatusColors",
  "useMangaStatusColors",
  "showPiePercentages",
].map((key) => `${APP_PREFIX}${key}`);

/**
 * Represents a cached item with size and last-modified metadata.
 * @source
 */
export interface CacheItem {
  /** Storage key identifying the cached entry (without prefix) */
  key: string;
  /** Item size in bytes */
  size: number;
  /** ISO string for the last modification time */
  lastModified: string;
}

/**
 * State shape for cache management.
 * @source
 */
export interface CacheState {
  /** Incrementing counter to trigger cache refreshes */
  cacheVersion: number;
}

/**
 * Actions for cache management.
 * @source
 */
export interface CacheActions {
  /** Read all anicards-* keys from localStorage and return metadata */
  getCacheItems: () => CacheItem[];
  /** Remove all known cache keys and increment version */
  clearAllCache: () => void;
  /** Remove specific cache item and increment version */
  deleteCacheItem: (key: string) => void;
  /** Manually trigger cache refresh */
  incrementCacheVersion: () => void;
}

/** Combined store type for cache management */
export type CacheStore = CacheState & CacheActions;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getUtf8ByteLength(value: string): number {
  // Best-effort byte size calculation across browser + test environments.
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }

  if (typeof Blob !== "undefined") {
    return new Blob([value]).size;
  }

  // Fallback (not truly bytes for non-ASCII), but avoids crashing.
  return value.length;
}

function coerceToIsoDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function tryExtractLastModified(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;

    // Common timestamp keys we may encounter in stored payloads.
    const direct =
      coerceToIsoDateString(parsed.lastModified) ??
      coerceToIsoDateString(parsed.updatedAt) ??
      coerceToIsoDateString(parsed.modifiedAt);
    if (direct) return direct;

    // Zustand persist commonly stores { state, version }.
    const state = parsed.state;
    if (isRecord(state)) {
      const fromState =
        coerceToIsoDateString(state.lastModified) ??
        coerceToIsoDateString(state.updatedAt) ??
        coerceToIsoDateString(state.modifiedAt);
      if (fromState) return fromState;
    }

    // Some legacy payloads may be wrapped as { value: ... }.
    const wrappedValue = parsed.value;
    if (isRecord(wrappedValue)) {
      const fromValue =
        coerceToIsoDateString(wrappedValue.lastModified) ??
        coerceToIsoDateString(wrappedValue.updatedAt) ??
        coerceToIsoDateString(wrappedValue.modifiedAt);
      if (fromValue) return fromValue;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clears all known cache keys from localStorage.
 */
function clearSiteCacheItems(): void {
  if (globalThis.window === undefined) return;

  for (const key of VALID_CACHE_KEYS) {
    localStorage.removeItem(key);
  }

  // Also clear any other anicards- prefixed keys not in the list
  const allKeys = Object.keys(localStorage).filter((key) =>
    key.startsWith(APP_PREFIX),
  );
  for (const key of allKeys) {
    localStorage.removeItem(key);
  }
}

/**
 * Zustand store for cache management with devtools.
 * Provides methods to get, clear, and delete cache items.
 * NOTE: This store does NOT persist its state - it's a thin wrapper around localStorage operations.
 * @source
 */
export const useCache = create<CacheStore>()(
  devtools(
    (set) => ({
      cacheVersion: 0,

      getCacheItems: () => {
        if (globalThis.window === undefined) return [];

        const storage = globalThis.window.localStorage;
        const fallbackLastModified = new Date().toISOString();
        const items: CacheItem[] = [];

        // Prefer Storage iteration APIs for correctness across environments.
        for (let i = 0; i < storage.length; i++) {
          const fullKey = storage.key(i);
          if (!fullKey?.startsWith(APP_PREFIX)) continue;

          const storedValue = storage.getItem(fullKey) ?? "";
          items.push({
            key: fullKey.slice(APP_PREFIX.length),
            size: getUtf8ByteLength(storedValue),
            lastModified:
              tryExtractLastModified(storedValue) ?? fallbackLastModified,
          });
        }

        items.sort((a, b) => a.key.localeCompare(b.key));
        return items;
      },

      clearAllCache: () => {
        clearSiteCacheItems();
        set(
          (state) => ({ cacheVersion: state.cacheVersion + 1 }),
          false,
          "clearAllCache",
        );
      },

      deleteCacheItem: (key: string) => {
        if (globalThis.window === undefined) return;

        const fullKey = key.startsWith(APP_PREFIX)
          ? key
          : `${APP_PREFIX}${key}`;
        localStorage.removeItem(fullKey);

        set(
          (state) => ({ cacheVersion: state.cacheVersion + 1 }),
          false,
          "deleteCacheItem",
        );
      },

      incrementCacheVersion: () => {
        set(
          (state) => ({ cacheVersion: state.cacheVersion + 1 }),
          false,
          "incrementCacheVersion",
        );
      },
    }),
    { name: "Cache" },
  ),
);
