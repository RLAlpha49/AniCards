import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  clearInstallPromptDismissal,
  INSTALL_PROMPT_DISMISSAL_COOLDOWN_MS,
  isInstallPromptDismissed,
  isStandaloneDisplayMode,
  readInstallPromptDismissedAt,
  writeInstallPromptDismissedAt,
} from "@/components/PwaRegistration";

function createStorageMock(initialEntries?: Record<string, string>) {
  const values = new Map(Object.entries(initialEntries ?? {}));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("PwaRegistration install prompt helpers", () => {
  it("stores and clears the install-prompt dismissal timestamp defensively", () => {
    const storage = createStorageMock();

    expect(readInstallPromptDismissedAt(storage)).toBeNull();

    writeInstallPromptDismissedAt(123456789, storage);
    expect(readInstallPromptDismissedAt(storage)).toBe(123456789);

    clearInstallPromptDismissal(storage);

    expect(readInstallPromptDismissedAt(storage)).toBeNull();
  });

  it("suppresses the install CTA until the dismissal cooldown expires", () => {
    const storage = createStorageMock();
    const dismissedAt = 1_700_000_000_000;

    writeInstallPromptDismissedAt(dismissedAt, storage);

    expect(isInstallPromptDismissed(storage, dismissedAt)).toBe(true);
    expect(
      isInstallPromptDismissed(
        storage,
        dismissedAt + INSTALL_PROMPT_DISMISSAL_COOLDOWN_MS - 1,
      ),
    ).toBe(true);
    expect(
      isInstallPromptDismissed(
        storage,
        dismissedAt + INSTALL_PROMPT_DISMISSAL_COOLDOWN_MS,
      ),
    ).toBe(false);
  });

  it("detects installed display mode from media query or iOS standalone mode", () => {
    expect(
      isStandaloneDisplayMode(
        () => ({
          matches: true,
        }),
        undefined,
      ),
    ).toBe(true);

    expect(
      isStandaloneDisplayMode(
        () => ({
          matches: false,
        }),
        {
          standalone: true,
        } as Navigator & { standalone?: boolean },
      ),
    ).toBe(true);

    expect(
      isStandaloneDisplayMode(
        () => ({
          matches: false,
        }),
        undefined,
      ),
    ).toBe(false);
  });
});
