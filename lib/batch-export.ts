import JSZip from "jszip";

import {
  type ConversionFormat,
  convertSvgToBlob,
  readSvgMarkupFromObjectUrl,
  type SvgConversionSource,
} from "@/lib/utils";

export type { ConversionFormat } from "@/lib/utils";

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
  format: ConversionFormat;
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
  format: ConversionFormat;
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
  const queue = cards.map((card, index) => ({ card, index }));
  let nextQueueIndex = 0;
  const total = cards.length;
  let completed = 0;
  let successCount = 0;
  let failureCount = 0;

  const convertCard = async (
    card: BatchExportCard,
    index: number,
  ): Promise<BatchConversionResult> => {
    try {
      let source: string | SvgConversionSource = card.svgUrl;

      if (card.cachedSvgObjectUrl) {
        try {
          source = {
            svgContent: await readSvgMarkupFromObjectUrl(
              card.cachedSvgObjectUrl,
            ),
          };
        } catch (error) {
          console.warn(
            `Failed to reuse cached preview SVG for ${card.rawType || card.type}; falling back to URL conversion.`,
            error,
          );
        }
      }

      const blob = await convertSvgToBlob(source, format);
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

  const getNextQueueEntry = () => {
    if (nextQueueIndex >= queue.length) {
      return null;
    }

    const next = queue[nextQueueIndex];
    nextQueueIndex += 1;
    return next;
  };

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
  format: ConversionFormat,
  progressCallback?: (progress: BatchConversionProgress) => void,
): Promise<BatchExportSummary> {
  if (cards.length === 0) {
    throw new Error("No cards available for export.");
  }

  const conversionResults = await batchConvertSvgsToPngs(
    cards,
    format,
    progressCallback,
  );

  const successful = conversionResults.filter(
    (result): result is BatchConversionSuccess => result.success,
  );

  if (successful.length === 0) {
    throw new Error("Unable to convert any cards for export.");
  }

  const images: BatchConversionImage[] = successful.map((result) => ({
    filename: `${result.card.rawType || result.card.type}.${format}`,
    blob: result.blob,
    format: result.format,
  }));

  const zipBlob = await generateZipFromImages(images);
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  downloadBlob(zipBlob, `anicards-export-${timestamp}.zip`);

  // Collect details about failed conversions to provide actionable feedback to the caller.
  const failedResults = conversionResults.filter(
    (result): result is BatchConversionFailure => !result.success,
  );

  const failedCards = failedResults.map((f) => ({
    type: f.card.type,
    rawType: f.card.rawType,
    error: f.error,
  }));

  return {
    total: cards.length,
    exported: successful.length,
    failed: conversionResults.length - successful.length,
    failedCards: failedCards.length > 0 ? failedCards : undefined,
  };
}
