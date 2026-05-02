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

function getClipboardWriteMock() {
  return globalThis.navigator.clipboard.writeText;
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

    const fetchMock = Object.assign(
      mock(async () => {
        return new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
          headers: { "Content-Type": "image/svg+xml" },
          status: 200,
        });
      }),
      originalFetch,
    );
    globalThis.fetch = fetchMock;
    URL.createObjectURL = mock(() => "blob:cached-preview");
    URL.revokeObjectURL = mock(() => undefined);
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

    const [animeStatsShareCard, animeGenresShareCard] = result.shareableCards;
    if (!animeStatsShareCard || !animeGenresShareCard) {
      throw new TypeError("Expected two shareable cards.");
    }

    const animeStatsUrl = new URL(animeStatsShareCard.url);
    expect(animeStatsUrl.searchParams.get("userId")).toBe("42");
    expect(animeStatsUrl.searchParams.get("cardType")).toBe("animeStats");
    expect(animeStatsUrl.searchParams.get("variation")).toBe("compact");
    expect(animeStatsUrl.searchParams.get("colorPreset")).toBe("default");

    const animeGenresUrl = new URL(animeGenresShareCard.url);
    expect(animeGenresUrl.searchParams.get("cardType")).toBe("animeGenres");
    expect(animeGenresUrl.searchParams.get("variation")).toBe("radar");
    expect(animeGenresUrl.searchParams.get("colorPreset")).toBeNull();
    expect(animeGenresUrl.searchParams.get("titleColor")).toBe("#aaaaaa");
    expect(animeGenresUrl.searchParams.get("borderColor")).toBe("#123456");
    expect(animeGenresUrl.searchParams.get("piePercentages")).toBeNull();
  });

  it("copies resolved absolute URLs, skips invalid ones, and logs bad inputs", async () => {
    const { copyShareableCardUrlsToClipboard } = await importRealShareUtils();
    const clipboardWrite = getClipboardWriteMock();
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
    const clipboardWrite = getClipboardWriteMock();
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

  it("builds ordered showcase clipboard exports for markdown, html, and manifests", async () => {
    const { copyShareableCardUrlsToClipboard } = await importRealShareUtils();
    const clipboardWrite = getClipboardWriteMock();

    const markdown = await copyShareableCardUrlsToClipboard(
      [
        {
          cardId: "animeStats",
          rawType: "animeStats-compact",
          url: "/card.svg?cardType=animeStats&variation=compact",
        },
        {
          cardId: "animeGenres",
          rawType: "animeGenres-radar",
          url: "https://cdn.example.test/cards/animeGenres-radar.svg",
        },
      ],
      "markdown",
    );

    expect(markdown).toEqual({
      copiedCount: 2,
      lines: [
        "[![AniCards animeStats-compact](https://anicards.test/card.svg?cardType=animeStats&variation=compact)](https://anicards.test/card.svg?cardType=animeStats&variation=compact)",
        "[![AniCards animeGenres-radar](https://cdn.example.test/cards/animeGenres-radar.svg)](https://cdn.example.test/cards/animeGenres-radar.svg)",
      ],
    });
    expect(clipboardWrite).toHaveBeenLastCalledWith(markdown.lines.join("\n"));

    const html = await copyShareableCardUrlsToClipboard(
      [
        {
          cardId: "animeStats",
          rawType: "animeStats-compact",
          url: "/card.svg?cardType=animeStats&variation=compact",
        },
      ],
      "html",
    );

    expect(html).toEqual({
      copiedCount: 1,
      lines: [
        '<section class="anicards-showcase">',
        '  <a href="https://anicards.test/card.svg?cardType=animeStats&amp;variation=compact" data-card-id="animeStats" data-card-raw-type="animeStats-compact">',
        '    <img src="https://anicards.test/card.svg?cardType=animeStats&amp;variation=compact" alt="AniCards animeStats-compact" loading="lazy" />',
        "  </a>",
        "</section>",
      ],
    });
    expect(clipboardWrite).toHaveBeenLastCalledWith(html.lines.join("\n"));

    const manifest = await copyShareableCardUrlsToClipboard(
      [
        {
          cardId: "animeStats",
          rawType: "animeStats-compact",
          url: "/card.svg?cardType=animeStats&variation=compact",
        },
        {
          cardId: "animeGenres",
          rawType: "animeGenres-radar",
          url: "https://cdn.example.test/cards/animeGenres-radar.svg",
        },
      ],
      "manifest",
    );

    expect(manifest).toEqual({
      copiedCount: 2,
      lines: [
        "{",
        '  "schemaVersion": 1,',
        '  "kind": "anicards-showcase",',
        '  "cards": [',
        "    {",
        '      "order": 1,',
        '      "cardId": "animeStats",',
        '      "rawType": "animeStats-compact",',
        '      "url": "https://anicards.test/card.svg?cardType=animeStats&variation=compact"',
        "    },",
        "    {",
        '      "order": 2,',
        '      "cardId": "animeGenres",',
        '      "rawType": "animeGenres-radar",',
        '      "url": "https://cdn.example.test/cards/animeGenres-radar.svg"',
        "    }",
        "  ]",
        "}",
      ],
    });
    expect(clipboardWrite).toHaveBeenLastCalledWith(manifest.lines.join("\n"));
  });

  it("orders card ids with cardOrder first and alphabetic fallback while honoring filters", async () => {
    const { getOrderedCardIds } = await importRealShareUtils();

    const ordered = getOrderedCardIds({
      cardConfigs: createConfigs(),
      cardOrder: ["animeGenres", "missingCard", "animeStats"],
      includeCardId: (cardId) => cardId !== "profileOverview",
    });

    expect(ordered).toEqual(["animeGenres", "animeStats"]);
  });

  it("loads batch export only when share downloads are requested", async () => {
    const progressSpy = mock(() => undefined);
    const batchConvertAndZip = mock(
      async (
        cards: Array<{
          cachedSvgObjectUrl?: string | null;
          rawType: string;
          svgUrl: string;
          type: string;
        }>,
        format: string,
        onProgress?: (progress: {
          cardIndex: number;
          current: number;
          failure: number;
          success: number;
          total: number;
        }) => void,
      ) => {
        onProgress?.({
          cardIndex: 0,
          current: 1,
          failure: 0,
          success: 1,
          total: cards.length,
        });

        return {
          total: cards.length,
          exported: cards.length,
          failed: 0,
          failedCards: undefined,
        };
      },
    );

    mock.module("@/lib/batch-export", () => ({
      batchConvertAndZip,
    }));

    const { downloadShareableCards } = await importRealShareUtils();

    expect(batchConvertAndZip).not.toHaveBeenCalled();

    const result = await downloadShareableCards({
      cards: [
        {
          cachedSvgObjectUrl: "blob:cached-preview",
          cardId: "animeStats",
          rawType: "animeStats-compact",
          url: "/api/card.svg?cardType=animeStats&variation=compact",
        },
      ],
      format: "webp",
      onProgress: progressSpy,
    });

    expect(result).toEqual({
      total: 1,
      exported: 1,
      failed: 0,
      failedCards: undefined,
    });
    expect(progressSpy).toHaveBeenCalledWith({
      current: 1,
      total: 1,
    });

    const firstCall = batchConvertAndZip.mock.calls[0];
    if (!firstCall) {
      throw new TypeError("Expected share downloads to load batch export.");
    }

    const [batchCards, format] = firstCall;

    expect(format).toBe("webp");
    expect(batchCards).toEqual([
      {
        cachedSvgObjectUrl: "blob:cached-preview",
        rawType: "animeStats-compact",
        svgUrl: "/api/card.svg?cardType=animeStats&variation=compact",
        type: "animeStats",
      },
    ]);
  });
});
