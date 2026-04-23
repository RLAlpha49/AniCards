import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

import type {
  SettingsSnapshot,
  SettingsTemplateV1,
} from "@/lib/user-page-settings-io";
import {
  clearPendingSettingsTemplateApply,
  consumePendingSettingsTemplateApply,
  EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY,
  getExamplesDiscoveryContextLabel,
  getExamplesDiscoveryContextReturnLabel,
  getRememberedUserPageRouteLabel,
  LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
  PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
  queuePendingSettingsTemplateApply,
  queueSettingsTemplateForEditor,
  readExamplesDiscoveryContext,
  readLastSuccessfulUserPageRoute,
  readPendingSettingsTemplateApply,
  readRecentSuccessfulUserPageRoutes,
  readSearchLaunchContinuityState,
  readSettingsTemplatesFromStorage,
  RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY,
  rememberLastSuccessfulUserPageRoute,
  SETTINGS_TEMPLATES_STORAGE_KEY,
  subscribeSearchLaunchContinuity,
  upsertSettingsTemplate,
  upsertSettingsTemplateInStorage,
  writeSettingsTemplatesToStorage,
} from "@/lib/user-page-settings-templates";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("https://anicards.test/examples");

const STORAGE_ERROR_MESSAGE =
  "Couldn't save template changes in this browser. Check storage permissions and try again.";

const originalDateNow = Date.now;
let mockNow = 1_713_744_000_000;

function createSnapshot(
  overrides: Partial<SettingsSnapshot> = {},
): SettingsSnapshot {
  return {
    colorPreset: overrides.colorPreset ?? "sunset",
    colors:
      overrides.colors ??
      ([
        "#111111",
        "#222222",
        "#333333",
        "#444444",
      ] as SettingsSnapshot["colors"]),
    borderEnabled: overrides.borderEnabled ?? true,
    borderColor: overrides.borderColor ?? "#fafafa",
    borderRadius: overrides.borderRadius ?? 12,
    advancedSettings: {
      useStatusColors: true,
      showPiePercentages: true,
      showFavorites: false,
      gridCols: 3,
      gridRows: 4,
      ...overrides.advancedSettings,
    },
  };
}

function createTemplate(
  overrides: Partial<SettingsTemplateV1> = {},
): SettingsTemplateV1 {
  return {
    id: overrides.id ?? "template-1",
    name: overrides.name ?? "Neon Grid",
    snapshot: overrides.snapshot ?? createSnapshot(),
    createdAt: overrides.createdAt ?? mockNow,
    updatedAt: overrides.updatedAt ?? mockNow,
  };
}

function dispatchStorageEvent(key: string | null) {
  const event = new Event("storage");

  Object.defineProperty(event, "key", {
    configurable: true,
    value: key,
  });

  globalThis.window.dispatchEvent(event);
}

function blockLocalStorageWrites() {
  const storage = globalThis.window.localStorage;
  const originalSetItem = storage.setItem.bind(storage);

  Object.defineProperty(storage, "setItem", {
    configurable: true,
    value: (() => {
      throw new Error("localStorage write blocked");
    }) as typeof storage.setItem,
  });

  return () => {
    Object.defineProperty(storage, "setItem", {
      configurable: true,
      value: originalSetItem,
    });
  };
}

beforeEach(() => {
  resetHappyDom("https://anicards.test/examples");
  mockNow = 1_713_744_000_000;
  Object.defineProperty(Date, "now", {
    configurable: true,
    value: () => mockNow,
  });
});

afterAll(() => {
  Object.defineProperty(Date, "now", {
    configurable: true,
    value: originalDateNow,
  });
  restoreHappyDom();
});

describe("user-page settings templates continuity helpers", () => {
  it("queues templates, pending applies, and discovery context for the editor", () => {
    const template = createTemplate();

    const result = queueSettingsTemplateForEditor(template, {
      source: "search-starter",
      exampleContext: {
        cardTypeId: "animeStats",
        cardTitle: "Anime Stats",
        variantName: "Minimal",
        themeLabel: "Dark",
      },
      discoveryContext: {
        source: "examples",
        href: " /examples/gallery ",
        routeKind: "gallery",
        searchQuery: " seasonal ",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new TypeError(
        "Expected queueSettingsTemplateForEditor to succeed.",
      );
    }

    expect(readSettingsTemplatesFromStorage()).toEqual([template]);
    expect(readExamplesDiscoveryContext()).toEqual({
      source: "examples",
      href: "/examples/gallery",
      routeKind: "gallery",
      savedAt: mockNow,
      searchQuery: "seasonal",
    });
    expect(readPendingSettingsTemplateApply()).toEqual({
      templateId: template.id,
      templateName: template.name,
      applyTo: "global",
      source: "search-starter",
      queuedAt: mockNow,
      exampleContext: {
        cardTypeId: "animeStats",
        cardTitle: "Anime Stats",
        variantName: "Minimal",
        themeLabel: "Dark",
      },
      discoveryContext: {
        source: "examples",
        href: "/examples/gallery",
        routeKind: "gallery",
        savedAt: mockNow,
        searchQuery: "seasonal",
      },
    });
    expect(
      globalThis.window.sessionStorage.getItem(
        PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      ),
    ).toBeTruthy();
    expect(
      globalThis.window.localStorage.getItem(
        EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY,
      ),
    ).toBeTruthy();
    expect(readSearchLaunchContinuityState()).toMatchObject({
      lastDiscoveryContext: {
        href: "/examples/gallery",
      },
      pendingTemplateApply: {
        templateId: template.id,
      },
      recentSuccessfulUserRoutes: [],
    });

    expect(consumePendingSettingsTemplateApply()).toMatchObject({
      templateId: template.id,
      source: "search-starter",
    });
    expect(readPendingSettingsTemplateApply()).toBeNull();
  });

  it("gracefully ignores malformed continuity payloads and returns friendly labels", () => {
    globalThis.window.sessionStorage.setItem(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      "{not-json",
    );
    globalThis.window.localStorage.setItem(
      EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        source: "examples",
        href: "/search",
        routeKind: "gallery",
        savedAt: "oops",
      }),
    );
    globalThis.window.localStorage.setItem(
      SETTINGS_TEMPLATES_STORAGE_KEY,
      JSON.stringify({
        exportedAt: new Date(mockNow).toISOString(),
        global: createSnapshot(),
        schemaVersion: 1,
        scope: "global",
      }),
    );

    expect(readPendingSettingsTemplateApply()).toBeNull();
    expect(readExamplesDiscoveryContext()).toBeNull();
    expect(readSettingsTemplatesFromStorage()).toEqual([]);
    expect(getExamplesDiscoveryContextLabel(null)).toBe("Examples");
    expect(
      getExamplesDiscoveryContextLabel({
        source: "examples",
        href: "/examples/romance",
        routeKind: "collection",
        collectionName: "Romance",
        searchQuery: " spark ",
      }),
    ).toBe("Romance collection · “spark”");
    expect(
      getExamplesDiscoveryContextReturnLabel({
        source: "examples",
        href: "/examples/gallery",
        routeKind: "gallery",
      }),
    ).toBe("Return to full gallery");
    expect(
      getRememberedUserPageRouteLabel({
        href: "/user?userId=42",
        savedAt: mockNow,
        userId: "42",
      }),
    ).toBe("AniList user 42");

    clearPendingSettingsTemplateApply();
    expect(readPendingSettingsTemplateApply()).toBeNull();
  });

  it("dedupes and caps remembered routes while preserving legacy fallback reads", () => {
    mockNow = 100;
    rememberLastSuccessfulUserPageRoute({
      userId: "1",
      username: "Alpha49",
    });
    mockNow = 200;
    rememberLastSuccessfulUserPageRoute({ userId: "2" });
    mockNow = 300;
    rememberLastSuccessfulUserPageRoute({
      userId: "3",
      username: "Gamma",
    });
    mockNow = 400;
    rememberLastSuccessfulUserPageRoute({ userId: "4" });
    mockNow = 500;
    rememberLastSuccessfulUserPageRoute({
      userId: "1",
      username: "Alpha49",
    });
    mockNow = 600;
    rememberLastSuccessfulUserPageRoute({ userId: "5" });

    const routes = readRecentSuccessfulUserPageRoutes();

    expect(routes.map((route) => route.userId)).toEqual(["5", "1", "4", "3"]);
    expect(routes.map((route) => route.href)).toEqual([
      "/user?userId=5",
      "/user/Alpha49",
      "/user?userId=4",
      "/user/Gamma",
    ]);
    expect(readLastSuccessfulUserPageRoute()).toMatchObject({
      href: "/user?userId=5",
      userId: "5",
    });

    globalThis.window.sessionStorage.removeItem(
      RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY,
    );
    globalThis.window.localStorage.removeItem(
      RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY,
    );
    globalThis.window.sessionStorage.removeItem(
      LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
    );
    globalThis.window.localStorage.setItem(
      LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
      JSON.stringify({
        href: "/user/LegacyUser",
        savedAt: 50,
        userId: "77",
        username: "LegacyUser",
      }),
    );

    expect(readRecentSuccessfulUserPageRoutes()).toEqual([
      {
        href: "/user/LegacyUser",
        savedAt: 50,
        userId: "77",
        username: "LegacyUser",
      },
    ]);
    expect(readLastSuccessfulUserPageRoute()).toEqual({
      href: "/user/LegacyUser",
      savedAt: 50,
      userId: "77",
      username: "LegacyUser",
    });
  });

  it("subscribes to continuity changes for custom and storage events", () => {
    const onChange = mock((state: unknown) => state);
    const unsubscribe = subscribeSearchLaunchContinuity(onChange);

    queuePendingSettingsTemplateApply({
      applyTo: "global",
      queuedAt: mockNow,
      source: "examples",
      templateId: "queued-template",
      templateName: "Queued Template",
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      pendingTemplateApply: {
        templateId: "queued-template",
      },
    });

    dispatchStorageEvent("unrelated-key");
    expect(onChange).toHaveBeenCalledTimes(1);

    dispatchStorageEvent(PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY);
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    clearPendingSettingsTemplateApply();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("preserves template createdAt on upsert and reports storage write failures", () => {
    const existing = createTemplate({
      createdAt: 10,
      id: "shared-template",
      name: "Original",
      updatedAt: 11,
    });
    const updated = createTemplate({
      createdAt: 999,
      id: "shared-template",
      name: "Updated",
      updatedAt: 20,
    });
    const restoreLocalStorage = blockLocalStorageWrites();

    try {
      expect(upsertSettingsTemplate([existing], updated)).toEqual([
        {
          ...updated,
          createdAt: 10,
        },
      ]);
      expect(writeSettingsTemplatesToStorage([existing])).toEqual({
        ok: false,
        error: STORAGE_ERROR_MESSAGE,
      });
      expect(upsertSettingsTemplateInStorage(updated)).toEqual({
        ok: false,
        error: STORAGE_ERROR_MESSAGE,
      });
    } finally {
      restoreLocalStorage();
    }
  });
});
