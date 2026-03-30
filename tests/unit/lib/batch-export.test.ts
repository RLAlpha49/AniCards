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

const convertSvgToBlob = mock();
const readSvgMarkupFromObjectUrl = mock();
const readSvgMarkupFromUrl = mock();
const cn = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

mock.module("@/lib/utils", () => ({
  cn,
  convertSvgToBlob,
  readSvgMarkupFromObjectUrl,
  readSvgMarkupFromUrl,
}));

installHappyDom();

const { batchConvertAndZip, batchConvertSvgsToPngs } =
  await import("@/lib/batch-export");

let createdAnchors: HTMLAnchorElement[] = [];
const originalCreateElement = document.createElement.bind(document);
const originalAnchorClick = HTMLAnchorElement.prototype.click;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const anchorClick = mock(() => {});
const createObjectURL = mock((resource: Blob | MediaSource) => {
  void resource;
  return "blob:zip-download";
});
const revokeObjectURL = mock(() => {});

beforeEach(() => {
  resetHappyDom();
  createdAnchors = [];
  convertSvgToBlob.mockReset();
  readSvgMarkupFromObjectUrl.mockReset();
  readSvgMarkupFromUrl.mockReset();
  anchorClick.mockReset();
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
  createObjectURL.mockReturnValue("blob:zip-download");

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

async function waitFor(predicate: () => boolean, message: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }

    await Promise.resolve();
    await Bun.sleep(0);
  }

  throw new Error(message);
}

describe("batch-export queue scheduling", () => {
  it("uses index-based dequeueing while preserving concurrency, progress callbacks, and cardIndex reporting", async () => {
    const deferredConversions = Array.from({ length: 6 }, () =>
      createDeferred<Blob>(),
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
      async (
        source: string | { svgContent: string },
        format: "png" | "webp",
      ) => {
        void format;
        const sourceKey =
          typeof source === "string" ? source : source.svgContent;
        const match = /card-(\d+)/.exec(sourceKey);

        if (!match) {
          throw new Error(`Unexpected source key: ${sourceKey}`);
        }

        const cardIndex = Number(match[1]);
        startedSources.push(sourceKey);
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

    await waitFor(
      () => convertSvgToBlob.mock.calls.length === 4,
      "Expected initial workers to start four conversions.",
    );

    expect(startedSources).toEqual(["card-0", "card-1", "card-2", "card-3"]);
    expect(maxActiveConversions).toBe(4);

    deferredConversions[1].resolve(new Blob(["card-1"], { type: "image/png" }));
    await waitFor(
      () => convertSvgToBlob.mock.calls.length === 5,
      "Expected the next queued card to start after one worker finished.",
    );

    deferredConversions[2].reject(new Error("conversion failed for card-2"));
    await waitFor(
      () => convertSvgToBlob.mock.calls.length === 6,
      "Expected queue consumption to continue after a failed conversion.",
    );

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
