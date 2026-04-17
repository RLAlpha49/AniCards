import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import type { CardEditorConfig } from "@/lib/stores/user-page-editor";
import {
  createCardConfig,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom();

const originalConsoleError = console.error;
const originalFetch = globalThis.fetch;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

async function importRealPreviewCache() {
  return await import("../../../../components/user/tile/preview-cache");
}

async function importRealShareUtils() {
  return await import("../../../../components/user/share-utils");
}

async function importRealUtils() {
  return await import("../../../../lib/utils");
}

function createConfigs(): Record<string, CardEditorConfig> {
  return {
    animeStats: createCardConfig("animeStats", {
      enabled: true,
      variant: "compact",
    }),
    profileOverview: createCardConfig("profileOverview", {
      enabled: false,
    }),
    animeGenres: createCardConfig("animeGenres", {
      enabled: true,
      variant: "radar",
      colorOverride: {
        useCustomSettings: true,
        colorPreset: "custom",
        colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
      },
      advancedSettings: {
        showPiePercentages: false,
      },
      borderColor: "#123456",
      borderRadius: 24,
    }),
  };
}

describe("share-utils", () => {
  beforeEach(async () => {
    resetHappyDom("https://anicards.test/editor");
    mock.restore();

    const { __resetPreviewCacheForTests } = await importRealPreviewCache();
    __resetPreviewCacheForTests();

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: mock(async () => undefined),
      },
      configurable: true,
    });

    globalThis.fetch = mock(
      async () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
          headers: { "Content-Type": "image/svg+xml" },
          status: 200,
        }),
    ) as unknown as typeof fetch;
    URL.createObjectURL = mock(
      () => "blob:cached-preview",
    ) as typeof URL.createObjectURL;
    URL.revokeObjectURL = mock(() => undefined) as typeof URL.revokeObjectURL;
    console.error = originalConsoleError;
  });

  afterEach(async () => {
    const { __resetPreviewCacheForTests } = await importRealPreviewCache();
    __resetPreviewCacheForTests();
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    console.error = originalConsoleError;
  });

  afterAll(() => {
    restoreHappyDom();
  });

  it("returns nothing when shareable card building has no user id", async () => {
    const { buildShareableCards } = await importRealShareUtils();
    const result = buildShareableCards({
      userId: null,
      cardIds: ["animeStats"],
      cardConfigs: createConfigs(),
      globalColorPreset: "default",
      globalAdvancedSettings: {
        showFavorites: true,
        showPiePercentages: true,
        useStatusColors: true,
        gridCols: 3,
        gridRows: 3,
      },
      getEffectiveColors: () => ["#111111", "#222222", "#333333", "#444444"],
      getEffectiveBorderColor: () => undefined,
      getEffectiveBorderRadius: () => 8,
    });

    expect(result).toEqual({
      shareableCards: [],
      skippedDisabledCards: [],
    });
  });

  it("builds enabled shareable cards, skips disabled ones, and reuses cached previews when present", async () => {
    const { fetchAndCachePreviewObjectUrl } = await importRealPreviewCache();
    const { buildShareableCards } = await importRealShareUtils();
    const { toCardApiHref } = await importRealUtils();
    const configs = createConfigs();

    const initial = buildShareableCards({
      userId: "42",
      cardIds: ["animeStats", "profileOverview", "animeGenres"],
      cardConfigs: configs,
      globalColorPreset: "default",
      globalAdvancedSettings: {
        showFavorites: true,
        showPiePercentages: true,
        useStatusColors: true,
        gridCols: 3,
        gridRows: 3,
      },
      getEffectiveColors: (cardId) =>
        cardId === "animeGenres"
          ? ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"]
          : ["#111111", "#222222", "#333333", "#444444"],
      getEffectiveBorderColor: (cardId) =>
        cardId === "animeGenres" ? "#123456" : undefined,
      getEffectiveBorderRadius: (cardId) => (cardId === "animeGenres" ? 24 : 8),
    });

    const animeStatsCard = initial.shareableCards[0];
    if (!animeStatsCard) {
      throw new Error("Expected a shareable animeStats card.");
    }

    const animeStatsApiHref = toCardApiHref(animeStatsCard.url);
    if (!animeStatsApiHref) {
      throw new Error(
        "Expected animeStats share URL to map back to /api/card.",
      );
    }

    await fetchAndCachePreviewObjectUrl(animeStatsApiHref);

    const result = buildShareableCards({
      userId: "42",
      cardIds: ["animeStats", "profileOverview", "animeGenres"],
      cardConfigs: configs,
      globalColorPreset: "default",
      globalAdvancedSettings: {
        showFavorites: true,
        showPiePercentages: true,
        useStatusColors: true,
        gridCols: 3,
        gridRows: 3,
      },
      getEffectiveColors: (cardId) =>
        cardId === "animeGenres"
          ? ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"]
          : ["#111111", "#222222", "#333333", "#444444"],
      getEffectiveBorderColor: (cardId) =>
        cardId === "animeGenres" ? "#123456" : undefined,
      getEffectiveBorderRadius: (cardId) => (cardId === "animeGenres" ? 24 : 8),
    });

    expect(result.skippedDisabledCards).toEqual([
      {
        cardId: "profileOverview",
        rawType: "profileOverview-default",
      },
    ]);
    expect(result.shareableCards).toHaveLength(2);
    expect(result.shareableCards[0]).toMatchObject({
      cachedSvgObjectUrl: "blob:cached-preview",
      cardId: "animeStats",
      rawType: "animeStats-compact",
    });
    expect(result.shareableCards[1]).toMatchObject({
      cachedSvgObjectUrl: null,
      cardId: "animeGenres",
      rawType: "animeGenres-radar",
    });

    const animeStatsUrl = new URL(result.shareableCards[0]!.url);
    expect(animeStatsUrl.searchParams.get("userId")).toBe("42");
    expect(animeStatsUrl.searchParams.get("cardType")).toBe("animeStats");
    expect(animeStatsUrl.searchParams.get("variation")).toBe("compact");
    expect(animeStatsUrl.searchParams.get("colorPreset")).toBe("default");

    const animeGenresUrl = new URL(result.shareableCards[1]!.url);
    expect(animeGenresUrl.searchParams.get("cardType")).toBe("animeGenres");
    expect(animeGenresUrl.searchParams.get("variation")).toBe("radar");
    expect(animeGenresUrl.searchParams.get("colorPreset")).toBeNull();
    expect(animeGenresUrl.searchParams.get("titleColor")).toBe("#aaaaaa");
    expect(animeGenresUrl.searchParams.get("borderColor")).toBe("#123456");
    expect(animeGenresUrl.searchParams.get("piePercentages")).toBeNull();
  });

  it("copies resolved absolute URLs, skips invalid ones, and logs bad inputs", async () => {
    const { copyShareableCardUrlsToClipboard } = await importRealShareUtils();
    const clipboardWrite = globalThis.navigator.clipboard
      .writeText as ReturnType<typeof mock>;
    const consoleError = mock(() => undefined);
    console.error = consoleError;

    const result = await copyShareableCardUrlsToClipboard([
      {
        cardId: "animeStats",
        url: "/card.svg?cardType=animeStats&variation=compact",
      },
      {
        cardId: "animeGenres",
        url: "https://cdn.example.test/cards/animeGenres-radar.svg",
      },
      {
        cardId: "brokenCard",
        url: "http://%",
      },
    ]);

    expect(result).toEqual({
      copiedCount: 2,
      lines: [
        "https://anicards.test/card.svg?cardType=animeStats&variation=compact",
        "https://cdn.example.test/cards/animeGenres-radar.svg",
      ],
    });
    expect(clipboardWrite).toHaveBeenCalledWith(
      [
        "https://anicards.test/card.svg?cardType=animeStats&variation=compact",
        "https://cdn.example.test/cards/animeGenres-radar.svg",
      ].join("\n"),
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("supports AniList formatting and throws when every card URL is invalid", async () => {
    const { copyShareableCardUrlsToClipboard } = await importRealShareUtils();
    const clipboardWrite = globalThis.navigator.clipboard
      .writeText as ReturnType<typeof mock>;
    const consoleError = mock(() => undefined);
    console.error = consoleError;

    const copied = await copyShareableCardUrlsToClipboard(
      [
        {
          cardId: "animeStats",
          url: "/card.svg?cardType=animeStats&variation=compact",
        },
      ],
      "anilist",
    );

    expect(copied).toEqual({
      copiedCount: 1,
      lines: [
        "img200(https://anicards.test/card.svg?cardType=animeStats&variation=compact)",
      ],
    });
    expect(clipboardWrite).toHaveBeenCalledWith(
      "img200(https://anicards.test/card.svg?cardType=animeStats&variation=compact)",
    );

    await expect(
      copyShareableCardUrlsToClipboard([
        {
          cardId: "brokenCard",
          url: "http://%",
        },
      ]),
    ).rejects.toThrow("No valid card URLs available to copy.");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
