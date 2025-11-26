import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

/**
 * State shape for user preferences.
 * @source
 */
export interface UserPreferencesState {
  /** Whether the sidebar should default to open */
  sidebarDefaultOpen: boolean;
  /** Pre-filled username for card generation */
  defaultUsername: string;
}

/**
 * Actions for updating user preferences.
 * @source
 */
export interface UserPreferencesActions {
  /** Update sidebar default open preference */
  setSidebarDefaultOpen: (value: boolean) => void;
  /** Update default username */
  setDefaultUsername: (value: string) => void;
  /** Reset all user preferences to defaults */
  resetUserPreferences: () => void;
}

/** Combined store type for user preferences */
export type UserPreferencesStore = UserPreferencesState &
  UserPreferencesActions;

const APP_PREFIX = "anicards-";

/**
 * Default values for user preferences
 */
const defaultState: UserPreferencesState = {
  sidebarDefaultOpen: false,
  defaultUsername: "",
};

/**
 * Custom storage adapter that handles the {value, lastModified} format
 * for backward compatibility with existing localStorage data.
 */
function createUserPreferencesStorage() {
  const maybeWindow = globalThis.window;

  if (!maybeWindow || maybeWindow.localStorage === undefined) {
    const memory = new Map<string, string>();
    return {
      getItem: (name: string) => memory.get(name) ?? null,
      setItem: (name: string, value: string) => memory.set(name, value),
      removeItem: (name: string) => memory.delete(name),
    };
  }

  const storage = maybeWindow.localStorage;

  return {
    getItem: (name: string): string | null => {
      const item = storage.getItem(name);
      if (!item) return null;
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === "object" && "state" in parsed) {
          return item;
        }
        return JSON.stringify({
          state: parsed.value ?? parsed,
          version: 1,
        });
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      storage.setItem(name, value);
    },
    removeItem: (name: string): void => {
      storage.removeItem(name);
    },
  };
}

const customStorage = createJSONStorage<UserPreferencesStore>(() =>
  createUserPreferencesStorage(),
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
    { key: "sidebarDefaultOpen", stateKey: "sidebarDefaultOpen" },
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
 * Handles sidebar default state and default username.
 * @source
 */
export const useUserPreferences = create<UserPreferencesStore>()(
  devtools(
    persist(
      (set) => ({
        ...defaultState,

        setSidebarDefaultOpen: (value: boolean) => {
          set({ sidebarDefaultOpen: value }, false, "setSidebarDefaultOpen");
        },

        setDefaultUsername: (value: string) => {
          set({ defaultUsername: value }, false, "setDefaultUsername");
        },

        resetUserPreferences: () => {
          set(defaultState, false, "resetUserPreferences");
        },
      }),
      {
        name: `${APP_PREFIX}user-preferences`,
        version: 1,
        storage: customStorage,
        onRehydrateStorage: () => (state, error) => {
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
