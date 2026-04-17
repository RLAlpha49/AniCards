import sharp from "sharp";

import { GET as getCardSvg } from "@/app/api/card/route";

const MAX_RASTER_INPUT_PIXELS = 16_777_216;
const CARD_NO_STORE_CACHE_CONTROL = "no-store, max-age=0, must-revalidate";
const CARD_NO_STORE_EDGE_CACHE_CONTROL = "no-store";
const PREVIEW_MEDIA_X_ROBOTS_TAG = "noindex, noimageindex, noarchive";
const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=";
const FALLBACK_PNG_BYTES = Uint8Array.from(
  Buffer.from(FALLBACK_PNG_BASE64, "base64"),
);

type CardSvgHandler = (request: Request) => Promise<Response>;
type RasterizeSvg = (svgMarkup: string) => Promise<Uint8Array<ArrayBuffer>>;

function withStaticCardRenderRequest(request: Request): Request {
  const url = new URL(request.url);

  if (!url.searchParams.has("animate")) {
    url.searchParams.set("animate", "false");
  }

  return new Request(url, request);
}

function withPreviewMediaRobotsTag(headers: Headers): Headers {
  headers.set("X-Robots-Tag", PREVIEW_MEDIA_X_ROBOTS_TAG);
  return headers;
}

function createPngHeaders(
  svgResponse: Response,
  options?: { useFallbackCachePolicy?: boolean },
): Headers {
  const headers = new Headers(svgResponse.headers);

  withPreviewMediaRobotsTag(headers);
  headers.set("Content-Type", "image/png");
  headers.delete("Content-Length");

  if (options?.useFallbackCachePolicy) {
    headers.set("Cache-Control", CARD_NO_STORE_CACHE_CONTROL);
    headers.set("CDN-Cache-Control", CARD_NO_STORE_EDGE_CACHE_CONTROL);
    headers.set("Edge-Cache-Control", CARD_NO_STORE_EDGE_CACHE_CONTROL);
  }

  return headers;
}

function withPreviewMediaRobotsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  withPreviewMediaRobotsTag(headers);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function rasterizeSvgMarkup(
  svgMarkup: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const pngBuffer = await sharp(Buffer.from(svgMarkup), {
    limitInputPixels: MAX_RASTER_INPUT_PIXELS,
  })
    .png()
    .toBuffer();

  return Uint8Array.from(pngBuffer);
}

function createPngFallbackResponse(svgResponse: Response): Response {
  return new Response(FALLBACK_PNG_BYTES.slice(), {
    headers: createPngHeaders(svgResponse, { useFallbackCachePolicy: true }),
    status: svgResponse.status,
    statusText: svgResponse.statusText,
  });
}

export async function convertCardSvgResponseToPngResponse(
  svgResponse: Response,
  rasterizeSvg: RasterizeSvg = rasterizeSvgMarkup,
): Promise<Response> {
  const contentType = svgResponse.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== "image/svg+xml") {
    return withPreviewMediaRobotsResponse(svgResponse);
  }

  const svgMarkup = await svgResponse.text();

  try {
    const pngBytes = await rasterizeSvg(svgMarkup);

    return new Response(pngBytes, {
      headers: createPngHeaders(svgResponse),
      status: svgResponse.status,
      statusText: svgResponse.statusText,
    });
  } catch {
    return createPngFallbackResponse(svgResponse);
  }
}

export function createCardPngRoute(
  cardSvgHandler: CardSvgHandler,
  rasterizeSvg: RasterizeSvg = rasterizeSvgMarkup,
) {
  return async function GET(request: Request): Promise<Response> {
    const svgResponse = await cardSvgHandler(
      withStaticCardRenderRequest(request),
    );
    return convertCardSvgResponseToPngResponse(svgResponse, rasterizeSvg);
  };
}

export const runtime = "nodejs";

export const GET = createCardPngRoute(getCardSvg);
