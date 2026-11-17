/**
 * A small helper that returns a storage adapter compatible with the Web Storage API
 * while providing compatibility for legacy persisted values by normalizing the
 * payloads to the { state, version } shape expected by `zustand/middleware`.
 *
 * This allows us to fallback to an in-memory Map when `window.localStorage` is
 * not available (SSR / tests) and to support legacy formats where the value
 * may have been stored directly or nested under a ``value`` property.
 */
export type LocalStorageLike = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

export function createBackwardCompatibleStorage(): LocalStorageLike {
  const maybeWindow = globalThis.window as Window | undefined;

  if (maybeWindow?.localStorage === undefined) {
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
