import sharp from "sharp";

import { GET as getCardSvg } from "@/app/api/card/route";

const MAX_RASTER_INPUT_PIXELS = 16_777_216;

type CardSvgHandler = (request: Request) => Promise<Response>;
type RasterizeSvg = (svgMarkup: string) => Promise<Uint8Array<ArrayBuffer>>;

function withStaticCardRenderRequest(request: Request): Request {
  const url = new URL(request.url);

  if (!url.searchParams.has("animate")) {
    url.searchParams.set("animate", "false");
  }

  return new Request(url, request);
}

function createPngHeaders(svgResponse: Response): Headers {
  const headers = new Headers(svgResponse.headers);
  headers.set("Content-Type", "image/png");
  headers.delete("Content-Length");
  return headers;
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

function createSvgFallbackResponse(
  svgResponse: Response,
  svgBytes: Uint8Array<ArrayBuffer>,
): Response {
  return new Response(svgBytes, {
    headers: new Headers(svgResponse.headers),
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

  if (!svgResponse.ok || contentType !== "image/svg+xml") {
    return svgResponse;
  }

  const svgBytes = new Uint8Array(await svgResponse.arrayBuffer());

  try {
    const svgMarkup = new TextDecoder().decode(svgBytes);
    const pngBytes = await rasterizeSvg(svgMarkup);

    return new Response(pngBytes, {
      headers: createPngHeaders(svgResponse),
      status: svgResponse.status,
      statusText: svgResponse.statusText,
    });
  } catch {
    return createSvgFallbackResponse(svgResponse, svgBytes);
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
