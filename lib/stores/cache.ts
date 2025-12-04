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

/**
 * Reads site-prefixed items from localStorage and returns a list of cached
 * entries with key, byte size, and last modified timestamp.
 */
function getSiteSpecificCacheItems(): CacheItem[] {
  if (globalThis.window === undefined) return [];

  return Object.keys(localStorage)
    .filter((key) => key.startsWith(APP_PREFIX))
    .map((key) => {
      const item = localStorage.getItem(key)!;
      let size = new Blob([item]).size;
      let lastModified = new Date().toISOString();

      try {
        const parsed = JSON.parse(item);
        if (parsed.lastModified) {
          lastModified = parsed.lastModified;
          size = new Blob([JSON.stringify(parsed)]).size;
        }
      } catch {
        // Ignore parse errors
      }

      return {
        key: key.replace(APP_PREFIX, ""),
        size,
        lastModified,
      };
    });
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
    (set, get) => ({
      cacheVersion: 0,

      clearAllCache: () => {
        clearSiteCacheItems();
        set(
          (state) => ({ cacheVersion: state.cacheVersion + 1 }),
          false,
          "clearAllCache",
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
