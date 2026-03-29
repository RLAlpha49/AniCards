import { describe, expect, it, mock } from "bun:test";

const convertSvgToBlob = mock();
const readSvgMarkupFromObjectUrl = mock();

mock.module("@/lib/utils", () => ({
  convertSvgToBlob,
  readSvgMarkupFromObjectUrl,
}));

const { batchConvertSvgsToPngs } = await import("@/lib/batch-export");

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
});
