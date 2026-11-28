/**
 * Converting card SVGs to raster images and downloading them as a ZIP.
 *
 * This is the only module that imports `jszip`. Keeping the dependency here
 * stops the client bundle from pulling it in through unrelated imports.
 * @source
 */
import JSZip from "jszip";
import { buildApiUrl } from "@/lib/api/base-url";
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/response";
import { createLogger } from "@/lib/log";

const log = createLogger("batch");

export type ConversionFormat = "png" | "webp";

/** A card entry used for batch export operations. @source */

export interface BatchExportCard {
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

type BatchConversionSuccess = {
  success: true;
  card: BatchExportCard;
  dataUrl: string;
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
  BatchConversionSuccess | BatchConversionFailure;

/** Image data used internally when packaging converted images into a ZIP. @source */

interface BatchConversionImage {
  filename: string;
  dataUrl: string;
  format: ConversionFormat;
}

/** Summary after exporting a batch of converted images. @source */

export interface BatchExportSummary {
  total: number;
  exported: number;
  failed: number;
}

/** Max number of concurrent conversions during batch processing. @source */

const BATCH_CONCURRENCY_LIMIT = 4;

/**
 * Converts an SVG file referenced by a URL to a raster image data URL via an API call.
 *
 * Makes a POST request to the conversion API endpoint with the SVG URL and requested format.
 *
 * @param svgUrl - The URL of the SVG file to be converted.
 * @param format - Desired output format ('png' | 'webp'). Defaults to 'png'.
 * @returns A Promise that resolves to the image data URL as a string.
 * @throws Error when the conversion process or network request fails.
 * @source
 */
export async function svgToPng(
  svgUrl: string,
  format: ConversionFormat = "png",
): Promise<string> {
  try {
    const isClient =
      (globalThis as unknown as { window?: unknown }).window !== undefined;
    const convertEndpoint = isClient ? "/api/convert" : buildApiUrl("/convert");
    const response = await fetch(convertEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgUrl, format }),
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new Error(
        `Failed to convert SVG: ${getResponseErrorMessage(response, payload)}`,
      );
    }

    return extractImageDataUrl(payload);
  } catch (error) {
    log.error("Conversion failed:", error);
    throw error;
  }
}

/**
 * Validate the parsed payload and extract the pngDataUrl property. Throws on invalid payloads.
 * @source
 */
function extractImageDataUrl(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Invalid response from convert API: missing or invalid pngDataUrl",
    );
  }
  const maybe = (payload as Record<string, unknown>).pngDataUrl;
  if (typeof maybe !== "string" || !maybe.trim()) {
    throw new Error(
      "Invalid response from convert API: missing or invalid pngDataUrl",
    );
  }
  return maybe;
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
  const queue = cards.map((card, index) => ({ card, index }));
  const total = cards.length;
  let completed = 0;
  let successCount = 0;
  let failureCount = 0;

  const convertCard = async (
    card: BatchExportCard,
    index: number,
  ): Promise<BatchConversionResult> => {
    try {
      const dataUrl = await svgToPng(card.svgUrl, format);
      successCount += 1;
      return {
        success: true,
        card,
        dataUrl,
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
    while (queue.length > 0) {
      const next = queue.shift();
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
    const [, base64] = image.dataUrl.split(",");
    if (!base64) continue;
    zip.file(image.filename, base64, { base64: true });
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
    dataUrl: result.dataUrl,
    format: result.format,
  }));

  const zipBlob = await generateZipFromImages(images);
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  downloadBlob(zipBlob, `anicards-export-${timestamp}.zip`);

  return {
    total: cards.length,
    exported: successful.length,
    failed: conversionResults.length - successful.length,
  };
}
