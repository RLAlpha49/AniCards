import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { createBackwardCompatibleStorage } from "@/lib/stores/storage-adapter";

/**
 * State shape for user preferences.
 * @source
 */
export interface UserPreferencesState {
  /** Pre-filled username for card generation */
  defaultUsername: string;
}

/**
 * Actions for updating user preferences.
 * @source
 */
export interface UserPreferencesActions {
  /** Update default username */
  setDefaultUsername: (value: string) => void;
}

/** Combined store type for user preferences */
export type UserPreferencesStore = UserPreferencesState &
  UserPreferencesActions;

const APP_PREFIX = "anicards-";

/**
 * Default values for user preferences
 */
const defaultState: UserPreferencesState = {
  defaultUsername: "",
};

const customStorage = createJSONStorage<UserPreferencesStore>(() =>
  createBackwardCompatibleStorage(),
);

/**
 * Migrate legacy localStorage keys to the new store format.
 * Called after initial hydration.
 */
function migrateLegacyKeys(
  set: (state: Partial<UserPreferencesState>) => void,
) {
  const maybeWindow = globalThis.window;
  if (!maybeWindow) {
    return;
  }
  const storage = maybeWindow.localStorage;
  const legacyKeys = [
    { key: "defaultUsername", stateKey: "defaultUsername" },
  ] as const;

  let hasMigrated = false;
  const migratedState: Partial<UserPreferencesState> = {};

  for (const { key, stateKey } of legacyKeys) {
    const fullKey = `${APP_PREFIX}${key}`;
    const stored = storage.getItem(fullKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const value = parsed.value ?? parsed;
        if (value !== undefined && value !== null) {
          (migratedState as Record<string, unknown>)[stateKey] = value;
          hasMigrated = true;
        }
        // Remove legacy key after migration
        storage.removeItem(fullKey);
      } catch {
        // Ignore parse errors
      }
    }
  }

  if (hasMigrated) {
    set(migratedState);
  }
}

/**
 * Zustand store for user preferences with persistence and devtools.
 * Handles the default username.
 * @source
 */
export const useUserPreferences = create<UserPreferencesStore>()(
  devtools(
    persist(
      (set) => ({
        ...defaultState,

        setDefaultUsername: (value: string) => {
          set({ defaultUsername: value }, false, "setDefaultUsername");
        },
      }),
      {
        name: `${APP_PREFIX}user-preferences`,
        version: 1,
        storage: customStorage,
        onRehydrateStorage: () => (_state, error) => {
          if (error) {
            console.error("Error rehydrating user preferences:", error);
            return;
          }
          migrateLegacyKeys((partial) => {
            useUserPreferences.setState(partial);
          });
        },
        migrate: (persistedState, version) => {
          // Handle future migrations here
          if (version === 0) {
            // Migration from v0 to v1 (if needed in future)
          }
          return persistedState as UserPreferencesStore;
        },
      },
    ),
    { name: "UserPreferences" },
  ),
);
