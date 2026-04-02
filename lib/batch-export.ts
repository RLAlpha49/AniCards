import JSZip from "jszip";

import {
  type CardDownloadFormat,
  type ConversionFormat,
  convertSvgToBlob,
  readSvgMarkupFromObjectUrl,
  readSvgMarkupFromUrl,
} from "@/lib/utils";

export type { CardDownloadFormat, ConversionFormat } from "@/lib/utils";

/** A card entry used for batch export operations. @source */
export interface BatchExportCard {
  cachedSvgObjectUrl?: string | null;
  type: string;
  svgUrl: string;
  rawType: string;
}

/** Progress payload passed to a progress callback during batch conversion. @source */
export interface BatchConversionProgress {
  current: number;
  total: number;
  success: number;
  failure: number;
  cardIndex: number;
}

/** Successful result for a single conversion in a batch. @source */
type BatchConversionSuccess = {
  success: true;
  blob: Blob;
  card: BatchExportCard;
  format: CardDownloadFormat;
  cardIndex: number;
};

/** Failure result representation for a single conversion in a batch. @source */
type BatchConversionFailure = {
  success: false;
  card: BatchExportCard;
  error: string;
  cardIndex: number;
};

/** Union type representing the result of a batch conversion (success or failure). @source */
export type BatchConversionResult =
  | BatchConversionSuccess
  | BatchConversionFailure;

/** Image data used internally when packaging converted images into a ZIP. @source */
interface BatchConversionImage {
  filename: string;
  blob: Blob;
  format: CardDownloadFormat;
}

/** Summary after exporting a batch of converted images. @source */
export interface BatchExportSummary {
  total: number;
  exported: number;
  failed: number;
  failedCards?: { type: string; rawType: string; error?: string }[];
}

/** Max number of concurrent conversions during batch processing. @source */
const BATCH_CONCURRENCY_LIMIT = 4;

function createQueueCursor<T>(items: T[]): () => T | null {
  let nextIndex = 0;

  return () => {
    if (nextIndex >= items.length) {
      return null;
    }

    const next = items[nextIndex];
    nextIndex += 1;
    return next;
  };
}

async function readRawSvgMarkup(card: BatchExportCard): Promise<string> {
  if (card.cachedSvgObjectUrl) {
    try {
      return await readSvgMarkupFromObjectUrl(card.cachedSvgObjectUrl);
    } catch (error) {
      console.warn(
        `Failed to reuse cached preview SVG for ${card.rawType || card.type}; falling back to a live SVG fetch.`,
        error,
      );
    }
  }

  return await readSvgMarkupFromUrl(card.svgUrl);
}

async function convertCardToBlob(
  card: BatchExportCard,
  format: CardDownloadFormat,
): Promise<Blob> {
  if (format === "svg") {
    const svgMarkup = await readRawSvgMarkup(card);
    return new Blob([svgMarkup], { type: "image/svg+xml" });
  }

  return await convertSvgToBlob(card.svgUrl, format);
}

async function batchExportCards(
  cards: BatchExportCard[],
  format: CardDownloadFormat,
  progressCallback?: (progress: BatchConversionProgress) => void,
): Promise<BatchConversionResult[]> {
  const queue = cards.map((card, index) => ({ card, index }));
  const total = cards.length;
  let completed = 0;
  let successCount = 0;
  let failureCount = 0;
  const getNextQueueEntry = createQueueCursor(queue);

  const convertCard = async (
    card: BatchExportCard,
    index: number,
  ): Promise<BatchConversionResult> => {
    try {
      const blob = await convertCardToBlob(card, format);
      successCount += 1;
      return {
        success: true,
        blob,
        card,
        format,
        cardIndex: index,
      };
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        card,
        error: message,
        cardIndex: index,
      };
    } finally {
      completed += 1;
      progressCallback?.({
        current: completed,
        total,
        success: successCount,
        failure: failureCount,
        cardIndex: index,
      });
    }
  };

  const workers = new Array(
    Math.min(BATCH_CONCURRENCY_LIMIT, queue.length),
  ).fill(null);

  const results: BatchConversionResult[] = [];

  const worker = async () => {
    while (true) {
      const next = getNextQueueEntry();
      if (!next) break;
      const result = await convertCard(next.card, next.index);
      results.push(result);
    }
  };

  await Promise.all(workers.map(() => worker()));
  return results;
}

/**
 * Converts multiple SVG URLs to raster images with concurrency limits.
 *
 * @param cards - Cards to convert, each containing type/rawType and svgUrl.
 * @param format - Target format for conversion (png | webp).
 * @param progressCallback - Optional progress callback invoked per card.
 * @returns Array of success/failure results.
 * @source
 */
export async function batchConvertSvgsToPngs(
  cards: BatchExportCard[],
  format: ConversionFormat,
  progressCallback?: (progress: BatchConversionProgress) => void,
): Promise<BatchConversionResult[]> {
  return await batchExportCards(cards, format, progressCallback);
}

/**
 * Generates a ZIP archive from converted images.
 *
 * @param images - Image data with filenames and formats.
 * @returns ZIP blob ready for download.
 * @source
 */
export async function generateZipFromImages(
  images: BatchConversionImage[],
): Promise<Blob> {
  const zip = new JSZip();

  for (const image of images) {
    zip.file(image.filename, await image.blob.arrayBuffer());
  }

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Triggers a browser download for the provided blob.
 *
 * @param blob - Binary data to download.
 * @param filename - Desired filename for the download.
 * @source
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Converts multiple cards, zips the results, and triggers a download.
 *
 * @param cards - Cards to convert and bundle.
 * @param format - Target export format.
 * @param progressCallback - Optional progress callback for UI updates.
 * @returns Summary containing counts of success and failures.
 * @source
 */
export async function batchConvertAndZip(
  cards: BatchExportCard[],
  format: CardDownloadFormat,
  progressCallback?: (progress: BatchConversionProgress) => void,
): Promise<BatchExportSummary> {
  if (cards.length === 0) {
    throw new Error("No cards available for export.");
  }

  const queue = cards.map((card, index) => ({ card, index }));
  let completed = 0;
  let successCount = 0;
  let failureCount = 0;
  const zip = new JSZip();
  const pendingZipEntries = new Map<number, BatchConversionImage>();
  const failedCardIndexes = new Set<number>();
  const failedResults: BatchConversionFailure[] = [];
  let nextZipIndex = 0;
  let zipDrainChain = Promise.resolve();
  const getNextQueueEntry = createQueueCursor(queue);

  const drainZipQueue = () => {
    zipDrainChain = zipDrainChain.then(async () => {
      while (nextZipIndex < cards.length) {
        const pendingEntry = pendingZipEntries.get(nextZipIndex);
        if (pendingEntry) {
          pendingZipEntries.delete(nextZipIndex);
          zip.file(
            pendingEntry.filename,
            await pendingEntry.blob.arrayBuffer(),
          );
          nextZipIndex += 1;
          continue;
        }

        if (failedCardIndexes.has(nextZipIndex)) {
          nextZipIndex += 1;
          continue;
        }

        break;
      }
    });

    return zipDrainChain;
  };

  const convertCard = async (
    card: BatchExportCard,
    index: number,
  ): Promise<void> => {
    try {
      const blob = await convertCardToBlob(card, format);
      successCount += 1;
      pendingZipEntries.set(index, {
        filename: `${card.rawType || card.type}.${format}`,
        blob,
        format,
      });
    } catch (error) {
      failureCount += 1;
      failedCardIndexes.add(index);
      failedResults.push({
        success: false,
        card,
        error: error instanceof Error ? error.message : String(error),
        cardIndex: index,
      });
    } finally {
      completed += 1;
      progressCallback?.({
        current: completed,
        total: cards.length,
        success: successCount,
        failure: failureCount,
        cardIndex: index,
      });
      await drainZipQueue();
    }
  };

  const workers = new Array(
    Math.min(BATCH_CONCURRENCY_LIMIT, queue.length),
  ).fill(null);

  const worker = async () => {
    while (true) {
      const next = getNextQueueEntry();
      if (!next) {
        break;
      }

      await convertCard(next.card, next.index);
    }
  };

  await Promise.all(workers.map(() => worker()));
  await drainZipQueue();

  if (successCount === 0) {
    throw new Error("Unable to convert any cards for export.");
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  downloadBlob(zipBlob, `anicards-export-${timestamp}.zip`);

  const failedCards = failedResults.map((f) => ({
    type: f.card.type,
    rawType: f.card.rawType,
    error: f.error,
  }));

  return {
    total: cards.length,
    exported: successCount,
    failed: failureCount,
    failedCards: failedCards.length > 0 ? failedCards : undefined,
  };
}
