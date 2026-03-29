import sharp from "sharp";

import { GET as getCardSvg } from "@/app/api/card/route";

const MAX_RASTER_INPUT_PIXELS = 16_777_216;

type CardSvgHandler = (request: Request) => Promise<Response>;
type RasterizeSvg = (svgMarkup: string) => Promise<Uint8Array<ArrayBuffer>>;

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

export async function convertCardSvgResponseToPngResponse(
  svgResponse: Response,
  rasterizeSvg: RasterizeSvg = rasterizeSvgMarkup,
): Promise<Response> {
  const fallbackResponse = svgResponse.clone();
  const contentType = svgResponse.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();

  if (!svgResponse.ok || contentType !== "image/svg+xml") {
    return svgResponse;
  }

  try {
    const svgMarkup = await svgResponse.text();
    const pngBytes = await rasterizeSvg(svgMarkup);

    return new Response(new Blob([pngBytes], { type: "image/png" }), {
      headers: createPngHeaders(svgResponse),
      status: svgResponse.status,
      statusText: svgResponse.statusText,
    });
  } catch {
    return fallbackResponse;
  }
}

export function createCardPngRoute(
  cardSvgHandler: CardSvgHandler,
  rasterizeSvg: RasterizeSvg = rasterizeSvgMarkup,
) {
  return async function GET(request: Request): Promise<Response> {
    const svgResponse = await cardSvgHandler(request);
    return convertCardSvgResponseToPngResponse(svgResponse, rasterizeSvg);
  };
}

export const runtime = "nodejs";

export const GET = createCardPngRoute(getCardSvg);
