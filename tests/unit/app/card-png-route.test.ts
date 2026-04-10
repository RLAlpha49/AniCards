import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createCardPngRoute } from "@/app/card.png/route";

let lastRasterizedSvgMarkup: string | null = null;

function createDefaultSvgResponse(): Response {
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>',
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": "image/svg+xml",
        Vary: "Origin",
        "X-Cache-Source": "memory",
        "X-Request-Id": "req-card-png",
      },
      status: 200,
    },
  );
}

const rasterizeSvgMock = mock(async (svgMarkup: string) => {
  lastRasterizedSvgMarkup = svgMarkup;
  return Uint8Array.from(Buffer.from("FAKEPNG"));
});

const cardSvgGetMock = mock(async () => createDefaultSvgResponse());

const GET = createCardPngRoute(cardSvgGetMock, rasterizeSvgMock);

beforeEach(() => {
  lastRasterizedSvgMarkup = null;
  rasterizeSvgMock.mockReset();
  rasterizeSvgMock.mockImplementation(async (svgMarkup: string) => {
    lastRasterizedSvgMarkup = svgMarkup;
    return Uint8Array.from(Buffer.from("FAKEPNG"));
  });

  cardSvgGetMock.mockReset();
  cardSvgGetMock.mockImplementation(async () => createDefaultSvgResponse());
});

describe("/card.png route", () => {
  it("converts successful card SVG responses to PNG while preserving cache headers", async () => {
    const request = new Request(
      "http://localhost/card.png?userId=542244&cardType=animeStats",
    );

    const response = await GET(request);
    const firstForwardedCall = cardSvgGetMock.mock.calls.at(0) as
      | [Request]
      | undefined;
    const forwardedRequest = firstForwardedCall?.[0];

    expect(cardSvgGetMock).toHaveBeenCalledTimes(1);
    const forwardedUrl = new URL(forwardedRequest?.url ?? request.url);
    expect(forwardedUrl.searchParams.get("userId")).toBe("542244");
    expect(forwardedUrl.searchParams.get("cardType")).toBe("animeStats");
    expect(forwardedUrl.searchParams.get("animate")).toBe("false");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(response.headers.get("X-Cache-Source")).toBe("memory");
    expect(response.headers.get("X-Request-Id")).toBe("req-card-png");
    expect(lastRasterizedSvgMarkup).toContain("<svg");

    const body = Buffer.from(await response.arrayBuffer());
    expect(body.toString()).toBe("FAKEPNG");
  });

  it("preserves an explicit animate query when forwarding to the SVG route", async () => {
    await GET(
      new Request(
        "http://localhost/card.png?userId=542244&cardType=animeStats&animate=true",
      ),
    );

    const firstForwardedCall = cardSvgGetMock.mock.calls.at(0) as
      | [Request]
      | undefined;
    const forwardedRequest = firstForwardedCall?.[0];
    const forwardedUrl = new URL(forwardedRequest?.url ?? "http://localhost");

    expect(forwardedUrl.searchParams.get("animate")).toBe("true");
  });

  it("passes through non-successful SVG responses without rasterizing them", async () => {
    cardSvgGetMock.mockResolvedValueOnce(
      new Response("<svg>Not Found</svg>", {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "image/svg+xml",
        },
        status: 404,
      }),
    );

    const response = await GET(
      new Request("http://localhost/card.png?userId=1&cardType=animeStats"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await response.text()).toBe("<svg>Not Found</svg>");
    expect(rasterizeSvgMock).not.toHaveBeenCalled();
  });

  it("falls back to the original SVG response when PNG conversion fails", async () => {
    rasterizeSvgMock.mockImplementation(async (svgMarkup: string) => {
      lastRasterizedSvgMarkup = svgMarkup;
      throw new Error("conversion failed");
    });

    const response = await GET(
      new Request(
        "http://localhost/card.png?userId=542244&cardType=animeStats",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  });
});
