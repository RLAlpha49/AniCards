/**
 * Barrel export for all Zustand stores.
 * Provides a single import point for all stores:
 * `import { useUserPreferences, useCardSettings, useCache } from '@/lib/stores'`
 * @source
 */

// User Preferences Store
export {
  useUserPreferences,
  type UserPreferencesState,
  type UserPreferencesActions,
  type UserPreferencesStore,
} from "./user-preferences";

// Card Settings Store
export {
  useCardSettings,
  type SavedColorConfig,
  type CardSettingsState,
  type CardSettingsActions,
  type CardSettingsStore,
} from "./card-settings";

// Cache Store
export {
  useCache,
  VALID_CACHE_KEYS,
  type CacheItem,
  type CacheState,
  type CacheActions,
  type CacheStore,
} from "./cache";
