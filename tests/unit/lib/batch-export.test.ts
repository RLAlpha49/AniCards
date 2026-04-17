import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import JSZip from "jszip";

import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const realUtilsModule = {
  ...(await import(new URL("../../../lib/utils.ts", import.meta.url).href)),
} as typeof import("@/lib/utils");

const convertSvgToBlob = mock();
const readSvgMarkupFromObjectUrl = mock();
const readSvgMarkupFromUrl = mock();
const cn = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

installHappyDom();

let batchConvertAndZip: typeof import("@/lib/batch-export").batchConvertAndZip;
let batchConvertSvgsToPngs: typeof import("@/lib/batch-export").batchConvertSvgsToPngs;

let createdAnchors: HTMLAnchorElement[] = [];
const originalCreateElement = document.createElement.bind(document);
const originalAnchorClick = HTMLAnchorElement.prototype.click;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const anchorClick = mock(() => {});
const createObjectURL = mock((blob: Blob | MediaSource) => {
  if (!blob) {
    throw new Error("Expected ZIP blob");
  }

  return "blob:zip-download";
});
const revokeObjectURL = mock(() => {});

beforeEach(async () => {
  resetHappyDom();
  createdAnchors = [];
  convertSvgToBlob.mockReset();
  readSvgMarkupFromObjectUrl.mockReset();
  readSvgMarkupFromUrl.mockReset();
  anchorClick.mockReset();
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
  createObjectURL.mockReturnValue("blob:zip-download");

  mock.module("@/lib/utils", () => ({
    ...realUtilsModule,
    cn,
    convertSvgToBlob,
    readSvgMarkupFromObjectUrl,
    readSvgMarkupFromUrl,
  }));
  ({ batchConvertAndZip, batchConvertSvgsToPngs } =
    await import("@/lib/batch-export"));

  document.createElement = ((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "a") {
      createdAnchors.push(element as HTMLAnchorElement);
    }
    return element;
  }) as typeof document.createElement;

  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: anchorClick,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  document.createElement = originalCreateElement;
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: originalAnchorClick,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
  mock.module("@/lib/utils", () => realUtilsModule);
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

describe("batch-export queue scheduling", () => {
  it("uses index-based dequeueing while preserving concurrency, progress callbacks, and cardIndex reporting", async () => {
    const deferredConversions = Array.from({ length: 6 }, () =>
      createDeferred<Blob>(),
    );
    const conversionStarts = Array.from({ length: 6 }, () =>
      createDeferred<void>(),
    );
    const progressEvents: Array<{
      cardIndex: number;
      current: number;
      failure: number;
      success: number;
      total: number;
    }> = [];
    const startedSources: string[] = [];
    let activeConversions = 0;
    let maxActiveConversions = 0;

    convertSvgToBlob.mockReset();
    readSvgMarkupFromObjectUrl.mockReset();

    convertSvgToBlob.mockImplementation(
      async (source: string | { svgContent: string }) => {
        const sourceKey =
          typeof source === "string" ? source : source.svgContent;
        const match = /card-(\d+)/.exec(sourceKey);

        if (!match) {
          throw new Error(`Unexpected source key: ${sourceKey}`);
        }

        const cardIndex = Number(match[1]);
        startedSources.push(sourceKey);
        conversionStarts[cardIndex].resolve(undefined);
        activeConversions += 1;
        maxActiveConversions = Math.max(
          maxActiveConversions,
          activeConversions,
        );

        try {
          return await deferredConversions[cardIndex].promise;
        } finally {
          activeConversions -= 1;
        }
      },
    );

    const cards = Array.from({ length: 6 }, (_, index) => ({
      rawType: `raw-${index}`,
      svgUrl: `card-${index}`,
      type: `type-${index}`,
    }));

    const batchPromise = batchConvertSvgsToPngs(cards, "png", (progress) => {
      progressEvents.push({ ...progress });
    });

    await Promise.all(
      conversionStarts.slice(0, 4).map(({ promise }) => promise),
    );

    expect(startedSources).toEqual(["card-0", "card-1", "card-2", "card-3"]);
    expect(maxActiveConversions).toBe(4);

    deferredConversions[1].resolve(new Blob(["card-1"], { type: "image/png" }));
    await conversionStarts[4].promise;

    deferredConversions[2].reject(new Error("conversion failed for card-2"));
    await conversionStarts[5].promise;

    deferredConversions[0].resolve(new Blob(["card-0"], { type: "image/png" }));
    deferredConversions[3].resolve(new Blob(["card-3"], { type: "image/png" }));
    deferredConversions[4].resolve(new Blob(["card-4"], { type: "image/png" }));
    deferredConversions[5].resolve(new Blob(["card-5"], { type: "image/png" }));

    const results = await batchPromise;

    expect(startedSources).toEqual([
      "card-0",
      "card-1",
      "card-2",
      "card-3",
      "card-4",
      "card-5",
    ]);
    expect(maxActiveConversions).toBe(4);
    expect(results).toHaveLength(6);
    expect(results.map((result) => result.cardIndex)).toEqual([
      1, 2, 0, 3, 4, 5,
    ]);
    expect(results.map((result) => result.success)).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(progressEvents).toEqual([
      {
        cardIndex: 1,
        current: 1,
        failure: 0,
        success: 1,
        total: 6,
      },
      {
        cardIndex: 2,
        current: 2,
        failure: 1,
        success: 1,
        total: 6,
      },
      {
        cardIndex: 0,
        current: 3,
        failure: 1,
        success: 2,
        total: 6,
      },
      {
        cardIndex: 3,
        current: 4,
        failure: 1,
        success: 3,
        total: 6,
      },
      {
        cardIndex: 4,
        current: 5,
        failure: 1,
        success: 4,
        total: 6,
      },
      {
        cardIndex: 5,
        current: 6,
        failure: 1,
        success: 5,
        total: 6,
      },
    ]);
  });

  it("keeps raster exports URL-based even when a cached SVG preview exists", async () => {
    convertSvgToBlob.mockResolvedValueOnce(
      new Blob(["png"], { type: "image/png" }),
    );
    readSvgMarkupFromObjectUrl.mockResolvedValueOnce("<svg>cached</svg>");

    const results = await batchConvertSvgsToPngs(
      [
        {
          cachedSvgObjectUrl: "blob:cached-preview",
          rawType: "animeStats-default",
          svgUrl: "https://api.anicards.test/card.svg?card=animeStats",
          type: "animeStats",
        },
      ],
      "png",
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    expect(convertSvgToBlob).toHaveBeenCalledWith(
      "https://api.anicards.test/card.svg?card=animeStats",
      "png",
    );
    expect(readSvgMarkupFromObjectUrl).not.toHaveBeenCalled();
  });

  it("preserves input filename ordering in the generated ZIP when conversions finish out of order", async () => {
    const deferredConversions = Array.from({ length: 3 }, () =>
      createDeferred<Blob>(),
    );
    const conversionStarts = Array.from({ length: 3 }, () =>
      createDeferred<void>(),
    );

    convertSvgToBlob.mockImplementation(async (source: string) => {
      const match = /card-(\d+)/.exec(source);

      if (!match) {
        throw new Error(`Unexpected source key: ${source}`);
      }

      const cardIndex = Number(match[1]);
      conversionStarts[cardIndex].resolve(undefined);

      return await deferredConversions[cardIndex].promise;
    });

    const exportPromise = batchConvertAndZip(
      [
        { rawType: "raw-0", svgUrl: "card-0", type: "type-0" },
        { rawType: "raw-1", svgUrl: "card-1", type: "type-1" },
        { rawType: "raw-2", svgUrl: "card-2", type: "type-2" },
      ],
      "png",
    );

    await Promise.all(conversionStarts.map(({ promise }) => promise));

    deferredConversions[2].resolve(new Blob(["card-2"], { type: "image/png" }));
    deferredConversions[1].resolve(new Blob(["card-1"], { type: "image/png" }));
    deferredConversions[0].resolve(new Blob(["card-0"], { type: "image/png" }));

    const summary = await exportPromise;

    expect(summary).toEqual({
      total: 3,
      exported: 3,
      failed: 0,
      failedCards: undefined,
    });

    const firstCreateObjectUrlCall = createObjectURL.mock.calls[0];
    if (!firstCreateObjectUrlCall) {
      throw new TypeError("Expected PNG batch export to create a ZIP blob.");
    }

    const [zipBlob] = firstCreateObjectUrlCall;
    if (!(zipBlob instanceof Blob)) {
      throw new TypeError("Expected PNG batch export to create a ZIP blob.");
    }

    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual([
      "raw-0.png",
      "raw-1.png",
      "raw-2.png",
    ]);
  });

  it("packages raw SVG files into the ZIP without raster conversion", async () => {
    readSvgMarkupFromObjectUrl.mockResolvedValue('<svg data-cache="cached" />');
    readSvgMarkupFromUrl.mockImplementation(
      async (svgUrl: string) => `<svg data-url="${svgUrl}" />`,
    );

    const cards = [
      {
        rawType: "animeStats-default",
        svgUrl: "/api/card?card=animeStats",
        type: "animeStats",
      },
      {
        cachedSvgObjectUrl: "blob:cached-social-preview",
        rawType: "socialStats-default",
        svgUrl: "/api/card?card=socialStats",
        type: "socialStats",
      },
    ];

    const summary = await batchConvertAndZip(cards, "svg");

    expect(summary).toEqual({
      total: 2,
      exported: 2,
      failed: 0,
      failedCards: undefined,
    });
    expect(convertSvgToBlob).not.toHaveBeenCalled();
    expect(readSvgMarkupFromUrl).toHaveBeenCalledWith(
      "/api/card?card=animeStats",
    );
    expect(readSvgMarkupFromObjectUrl).toHaveBeenCalledWith(
      "blob:cached-social-preview",
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    const firstCreateObjectUrlCall = createObjectURL.mock.calls[0];
    if (!firstCreateObjectUrlCall) {
      throw new TypeError("Expected SVG batch export to create an object URL.");
    }

    const [zipBlob] = firstCreateObjectUrlCall;
    if (!(zipBlob instanceof Blob)) {
      throw new TypeError("Expected SVG batch export to create a ZIP blob.");
    }

    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files).sort((a, b) => a.localeCompare(b))).toEqual([
      "animeStats-default.svg",
      "socialStats-default.svg",
    ]);

    const animeStatsFile = zip.file("animeStats-default.svg");
    const socialStatsFile = zip.file("socialStats-default.svg");

    if (!animeStatsFile || !socialStatsFile) {
      throw new TypeError(
        "Expected the ZIP archive to contain both SVG files.",
      );
    }

    expect(await animeStatsFile.async("string")).toBe(
      '<svg data-url="/api/card?card=animeStats" />',
    );
    expect(await socialStatsFile.async("string")).toBe(
      '<svg data-cache="cached" />',
    );
    expect(anchorClick).toHaveBeenCalledTimes(1);

    const createdAnchor = createdAnchors[0];
    if (!createdAnchor) {
      throw new TypeError(
        "Expected the batch export to create a download anchor.",
      );
    }

    expect(createdAnchor.download).toMatch(/^anicards-export-.*\.zip$/);
    expect(createdAnchor.href).toBe("blob:zip-download");
  });
});
