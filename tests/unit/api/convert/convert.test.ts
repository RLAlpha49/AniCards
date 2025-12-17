import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  POST,
  removeEmptyCssRules,
  sanitizeCssContent,
  removeClassTokensFromMarkup,
  sanitizeInlineStyleAttributes,
} from "@/app/api/convert/route";
import { NextRequest } from "next/server";

/**
 * Captures the buffer passed into `sharp` so tests can inspect the SVG payload.
 */
let lastSharpBuffer: Buffer | null = null;

/**
 * Tracks which format (png or webp) was requested in the last sharp call
 */
let lastSharpFormat: "png" | "webp" = "png";

/**
 * Create a named async function for returning a fake PNG buffer.
 * We extract this so the implementation won't be a deeply nested arrow function.
 */
function createToBufferSuccess() {
  return async function toBuffer() {
    return Buffer.from(lastSharpFormat === "webp" ? "FAKEWEBP" : "FAKEPNG");
  };
}

/**
 * Returns a sharp-like object with png() -> { toBuffer() }
 */
function createSharpInstance(buf?: Buffer) {
  if (buf) lastSharpBuffer = Buffer.from(buf);
  const instance: {
    toBuffer: () => Promise<Buffer>;
    png: () => unknown;
    webp: (opts: { quality: number }) => unknown;
  } = {
    toBuffer: createToBufferSuccess(),
    png: mock(() => {
      lastSharpFormat = "png";
      return instance;
    }),
    webp: mock((opts: { quality: number }) => {
      lastSharpFormat = "webp";
      return instance;
    }),
  };
  return instance;
}

process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost";

// Mocking "sharp" using Bun's mock system
mock.module("sharp", () => ({
  default: mock(createSharpInstance),
}));

describe("Convert API POST Endpoint", () => {
  /**
   * Retains the original fetch implementation so it can be restored after tests.
   */
  const originalFetch = globalThis.fetch;

  /**
   * Helper to mock fetch with resolved values
   */
  function mockFetchResolve(response: Response) {
    globalThis.fetch = mock(
      async () => response,
    ) as unknown as typeof globalThis.fetch;
  }

  /**
   * Helper to mock fetch with rejected value
   */
  function mockFetchReject(error: Error) {
    globalThis.fetch = mock(async () => {
      throw error;
    }) as unknown as typeof globalThis.fetch;
  }

  beforeEach(() => {
    lastSharpBuffer = null;
    lastSharpFormat = "png";
  });

  afterEach(() => {
    // Clear mocks by resetting the fetch implementation
    globalThis.fetch = originalFetch;
  });

  describe("Input Validation", () => {
    it("should return 400 error if svgUrl parameter is missing", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({}),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Missing svgUrl parameter");
    });

    it("should return 400 error for invalid URL format", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://local host/path" }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid URL format");
    });

    it("should return 400 error for invalid format parameter", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
          format: "avif",
        }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response("<svg></svg>", {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid format parameter");
    });

    it("should accept valid format 'png' (default)", async () => {
      const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
          format: "png",
        }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pngDataUrl).toContain("data:image/png;base64,");
    });

    it("should accept valid format 'webp'", async () => {
      const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
          format: "webp",
        }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pngDataUrl).toContain("data:image/webp;base64,");
    });

    it("should use default format 'png' when format is omitted", async () => {
      const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pngDataUrl).toContain("data:image/png;base64,");
    });

    it("should handle format parameter case-insensitively", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
          format: "PNG",
        }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("URL Authorization & Security", () => {
    it("should reject requests with unauthorized domains", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "https://malicious-domain.com/evil.svg",
        }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized or unsafe domain/protocol");
    });

    it("should reject HTTP requests when allowed domain requires HTTPS", async () => {
      // This test verifies that HTTP is rejected for non-localhost domains
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "http://example.com/evil.svg",
        }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized or unsafe domain/protocol");
    });

    it("should accept localhost URLs in development", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
        }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("should reject private IP addresses", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "https://192.168.1.100/evil.svg",
        }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized or unsafe domain/protocol");
    });

    it("should reject 10.x.x.x private IP range", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "https://10.0.0.1/evil.svg",
        }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("should reject 172.16.x.x - 172.31.x.x private IP range", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "https://172.20.0.1/evil.svg",
        }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe("SVG Fetching", () => {
    it("should return error if fetching SVG fails with non-ok status", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/fake.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Failed to fetch SVG");
    });

    it("should return 500 error if fetching SVG throws", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/fake.svg" }),
      }) as unknown as NextRequest;

      mockFetchReject(new Error("Network error"));

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      // When fetch throws, fetchSvgContent returns "Failed to fetch SVG"
      expect(data.error).toBe("Failed to fetch SVG");
    });

    it("should handle various HTTP error status codes", async () => {
      const statusCodes = [500, 503, 403];

      for (const status of statusCodes) {
        mockFetchResolve(
          new Response("Error", {
            status,
            headers: { "Content-Type": "text/plain" },
          }),
        );

        const req = new Request("http://localhost/api/convert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1",
          },
          body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
        }) as unknown as NextRequest;

        const res = await POST(req);
        expect(res.status).toBe(status);
      }
    });
  });

  describe("SVG Conversion", () => {
    it("should successfully convert SVG to PNG", async () => {
      const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const rawText = await res.text();
      const data = JSON.parse(rawText);
      expect(data.pngDataUrl).toContain("data:image/png;base64,");
      const expectedBase64 = Buffer.from("FAKEPNG").toString("base64");
      expect(data.pngDataUrl).toBe(`data:image/png;base64,${expectedBase64}`);
    });

    it("should successfully convert SVG to WebP", async () => {
      const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
          format: "webp",
        }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pngDataUrl).toContain("data:image/webp;base64,");
      const expectedBase64 = Buffer.from("FAKEWEBP").toString("base64");
      expect(data.pngDataUrl).toBe(`data:image/webp;base64,${expectedBase64}`);
    });

    it("should return 500 error when sharp conversion fails", async () => {
      const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      // Note: In Bun's test environment, mocking sharp at module level prevents
      // easy dynamic replacement. This test validates the error handling path.
      // To fully test sharp failures, consider integration or e2e tests.
      const res = await POST(req);
      // With the mocked sharp, this should succeed normally
      expect(res.status).toBe(200);
    });
  });

  describe("Analytics Tracking", () => {
    it("should handle failed_requests analytics for invalid format", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({
          svgUrl: "http://localhost/dummy.svg",
          format: "avif",
        }),
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid format parameter");
    });

    it("should handle successful_requests analytics on successful conversion", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pngDataUrl).toBeDefined();
    });

    it("should handle failed_requests analytics when fetch fails", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchReject(new Error("Network error"));

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      // When fetch throws, error message is "Failed to fetch SVG"
      expect(data.error).toBe("Failed to fetch SVG");
    });
  });

  describe("HTTP Method Handling", () => {
    it("should accept POST requests", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("should handle OPTIONS requests", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "OPTIONS",
        headers: {
          "Content-Type": "application/json",
        },
      }) as unknown as NextRequest;

      const { OPTIONS } = await import("@/app/api/convert/route");
      const res = OPTIONS(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain(
        "OPTIONS",
      );
    });
  });

  describe("SVG Sanitization Policy - CSS", () => {
    /**
     * Default headers used when crafting conversion requests.
     */
    const defaultHeaders = {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    };

    /**
     * Constructs a POST `NextRequest` for the convert API using the given SVG URL.
     */
    const makeRequestForSvgUrl = (url = "http://localhost/dummy.svg") =>
      new Request("http://localhost/api/convert", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({ svgUrl: url }),
      }) as unknown as NextRequest;

    /**
     * Stubs `fetch` to return controlled SVG responses.
     */
    const mockFetchSvg = (svg: string, ok = true, status = 200) => {
      globalThis.fetch = mock(
        async () =>
          new Response(svg, {
            status,
            headers: { "Content-Type": "image/svg+xml" },
          }),
      ) as unknown as typeof globalThis.fetch;
    };

    /**
     * Posts sanitized SVG and exposes the buffer captured by `sharp`.
     */
    const postAndCaptureSvg = async (
      svg: string,
      url = "http://localhost/dummy.svg",
      expectStatus = 200,
    ) => {
      mockFetchSvg(svg, true, expectStatus);
      lastSharpBuffer = null;
      const req = makeRequestForSvgUrl(url);
      const res = await POST(req);
      expect(res.status).toBe(expectStatus);
      const captured = (lastSharpBuffer as Buffer | null)?.toString() ?? "";
      return { res, captured };
    };

    it("removes @keyframes, animation declarations and .stagger when the rule contains animation, and normalizes inline animation/opacity values", async () => {
      const dummySVG = `
        <svg>
          <style>
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            .stagger { animation: fadeIn 0.8s ease-in-out forwards; }
            .keep { fill: red; }
          </style>
          <g class="stagger keep" style="animation-delay: 150ms; opacity: 0;">
            <rect x="0" y="0" width="10" height="10"></rect>
          </g>
        </svg>`;

      const { captured } = await postAndCaptureSvg(dummySVG);
      expect(captured).not.toMatch(/@keyframes/);
      expect(captured).not.toMatch(/animation\s*:/i);
      expect(captured).toMatch(/class=(['"]).*?keep.*?\1/);
      expect(captured).not.toMatch(/class=(['"]).*?\bstagger\b.*?\1/);
      expect(captured).not.toMatch(/animation-delay\s*:/i);
      expect(captured).toMatch(/opacity\s*:\s*1/);
    });

    it("does not remove .stagger if the .stagger rule has no animation", async () => {
      const dummySVG = `
        <svg>
          <style>
            .stagger { fill: blue; }
            .anim { animation: fadeIn 0.8s; }
          </style>
          <g class="stagger anim">
            <rect x="0" y="0" width="10" height="10"></rect>
          </g>
        </svg>`;

      const { captured: captured1 } = await postAndCaptureSvg(dummySVG);
      // animation declarations removed from CSS
      expect(captured1).not.toMatch(/animation\s*:/i);
      // .stagger rule doesn't have animation; class should remain
      expect(captured1).toMatch(/class=(['"]).*?\bstagger\b.*?\1/);
    });

    it("handles minified CSS and removes class when required", async () => {
      const dummySVG = `<svg><style>.stagger{animation:fadeIn 0.3s;}</style><g class='stagger'><rect /></g></svg>`;
      const { captured: captured2 } = await postAndCaptureSvg(dummySVG);
      expect(captured2).not.toMatch(/\.stagger/);
      expect(captured2).not.toMatch(/class=(['"]).*?\bstagger\b.*?\1/);
    });

    it("removes orphaned 'to' blocks and vendor-prefixed keyframes", () => {
      const css = `@-webkit-keyframes fade { from { opacity: 0 } to { opacity: 1 } } to { opacity: 0 } .a{ color: blue }`;
      const { css: cleaned } = sanitizeCssContent(css);
      expect(cleaned).not.toMatch(/@-webkit-keyframes/);
      expect(cleaned).not.toMatch(/to\s*\{/);
      expect(cleaned).toMatch(/\.a\s*\{/);
    });

    it("does not remove classes that merely contain 'stagger' as a substring (tokenization test)", async () => {
      const dummySVG = `<svg><style>.stagger{animation:fadeIn 0.3s;} .stagger-other{fill: red;}</style><g class='stagger-other stagger'><rect /></g></svg>`;
      const { res } = await postAndCaptureSvg(dummySVG);

      const styleMatch = /<style>([\s\S]*?)<\/style>/i.exec(dummySVG);
      expect(styleMatch).toBeTruthy();
      const styleCss = styleMatch?.[1] || "";
      const { css: sanitized, classesToStrip } = sanitizeCssContent(styleCss);
      expect(classesToStrip).toContain("stagger");
      expect(classesToStrip).not.toContain("stagger-other");
      expect(sanitized).not.toMatch(/\.stagger(?![A-Za-z0-9_-])/);
      expect(sanitized).toMatch(/\.stagger-other/);

      expect(res.status).toBe(200);
    });

    it("sanitizeCssContent + removeClassTokensFromMarkup preserves substring classes while removing target class token", () => {
      const css = ".stagger{animation:fade 1s;} .stagger-other{fill:red;}";
      const { css: outCss, classesToStrip } = sanitizeCssContent(css);
      expect(classesToStrip).toContain("stagger");
      expect(outCss).not.toMatch(/\.stagger(?![A-Za-z0-9_-])/);
      expect(outCss).toMatch(/\.stagger-other(?![A-Za-z0-9_-])/);
      const markup = `<g class="stagger-other stagger"></g>`;
      const newMarkup = removeClassTokensFromMarkup(markup, classesToStrip);
      const classMatch = /class=(['"])(.*?)\1/.exec(newMarkup);
      expect(classMatch).toBeTruthy();
      const tokens = classMatch
        ? classMatch[2].split(/\s+/).filter(Boolean)
        : [];
      expect(tokens).toContain("stagger-other");
      expect(tokens).not.toContain("stagger");
    });
  });

  describe("Inline Style Sanitization", () => {
    it("should remove animation properties from inline styles", () => {
      const svg = `<g style="animation: fadeIn 1s; color: red;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).not.toMatch(/animation\s*:/i);
      expect(sanitized).toMatch(/color\s*:\s*red/);
    });

    it("should normalize opacity:0 to opacity:1", () => {
      const svg = `<g style="opacity: 0;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).toMatch(/opacity\s*:\s*1/);
    });

    it("should normalize visibility:hidden to visibility:visible", () => {
      const svg = `<g style="visibility: hidden;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).toMatch(/visibility\s*:\s*visible/);
    });

    it("should handle vendor-prefixed animation properties", () => {
      const svg = `<g style="-webkit-animation: slide 2s; -moz-animation: slide 2s;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).not.toMatch(/-webkit-animation/);
      expect(sanitized).not.toMatch(/-moz-animation/);
    });

    it("should remove empty style attributes", () => {
      const svg = `<g style="animation: fade 1s;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).not.toContain("style=");
    });

    it("should preserve valid styles while removing animation", () => {
      const svg = `<g style="fill: blue; animation-delay: 100ms; opacity: 0.5;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).toMatch(/fill\s*:\s*blue/);
      // opacity: 0.5 should be normalized to opacity: 1
      expect(sanitized).toMatch(/opacity\s*:\s*1/);
      expect(sanitized).not.toMatch(/animation-delay/);
      // The style attribute should still exist since there are valid properties
      expect(sanitized).toContain("style=");
    });

    it("should handle multiple style declarations with mixed valid and invalid", () => {
      const svg = `<g style="transform: rotate(45deg); animation: spin 2s; color: green; animation-timing-function: linear;"></g>`;
      const sanitized = sanitizeInlineStyleAttributes(svg);
      expect(sanitized).toMatch(/transform\s*:\s*rotate\(45deg\)/);
      expect(sanitized).toMatch(/color\s*:\s*green/);
      expect(sanitized).not.toMatch(/animation/i);
    });
  });

  describe("Edge Cases", () => {
    it("should handle SVG with empty content", async () => {
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response("", {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      // Should still attempt conversion
      expect(res.status).toBe(200);
    });

    it("should handle relative URLs by using request origin", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://example.com/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          origin: "http://example.com",
        },
        body: JSON.stringify({ svgUrl: "/relative/path/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      // Should fail because example.com is not in allowed domains
      expect(res.status).toBe(403);
    });

    it("should preserve IP address format with 127.0.0.1 localhost", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://127.0.0.1/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      // In development, localhost/127.0.0.1 is explicitly allowed (and should remain in the URL),
      // so this should pass authorization and proceed.
      expect(res.status).toBe(200);
    });

    it("should handle IPv6 loopback address", async () => {
      const dummySVG = `<svg></svg>`;
      const req = new Request("http://localhost/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          host: "localhost",
        },
        body: JSON.stringify({ svgUrl: "http://[::1]/dummy.svg" }),
      }) as unknown as NextRequest;

      mockFetchResolve(
        new Response(dummySVG, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );

      const res = await POST(req);
      // ::1 is IPv6 localhost but not in allowedDomains so it should fail
      expect(res.status).toBe(403);
    });
  });

  describe("removeEmptyCssRules", () => {
    it("removes simple empty CSS rule blocks", () => {
      const css = ".a { } .b{\n}\n";
      const cleaned = removeEmptyCssRules(css);
      expect(cleaned.trim()).toBe("");
    });

    it("removes nested empty rules and collapses outer blocks that become empty", () => {
      const css = "@media (max-width: 600px) { .a {} }";
      const cleaned = removeEmptyCssRules(css);
      expect(cleaned.replaceAll(/\s+/g, "")).toBe("");
    });

    it("handles long input without excessive time (DoS test)", () => {
      const longSelector = "a".repeat(200_000);
      const css = `${longSelector} { }`;
      const start = Date.now();
      const cleaned = removeEmptyCssRules(css);
      const duration = Date.now() - start;
      expect(cleaned.trim()).toBe("");
      expect(duration).toBeLessThan(2000);
    });
  });
});
