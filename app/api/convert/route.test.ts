import {
  POST,
  removeEmptyCssRules,
  sanitizeCssContent,
  removeClassTokensFromMarkup,
} from "./route";
import { NextRequest } from "next/server";
import sharp from "sharp";

/**
 * Captures the buffer passed into `sharp` so tests can inspect the SVG payload.
 * @source
 */
let lastSharpBuffer: Buffer | null = null;

/**
 * Create a named async function for returning a fake PNG buffer.
 * We extract this so the implementation won't be a deeply nested arrow function.
 */
function createToBufferSuccess() {
  return async function toBuffer() {
    return Buffer.from("FAKEPNG");
  };
}

/**
 * Create a named async function that throws to simulate conversion failures.
 */
function createToBufferFailure() {
  return async function toBuffer() {
    throw new Error("Sharp failure");
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
    webp: () => unknown;
  } = {
    toBuffer: createToBufferSuccess(),
    png: () => instance,
    webp: () => instance,
  };
  return instance;
}

process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost";

/** Create a named redis mock for convert tests */
function createRedisFromEnvMock() {
  return {
    incr: jest.fn(async () => 1),
  };
}

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(createRedisFromEnvMock),
  },
}));

// Mocking "sharp" so we can simulate the PNG conversion.
jest.mock("sharp", () => jest.fn(createSharpInstance));

describe("Convert API POST Endpoint", () => {
  /**
   * Retains the original fetch implementation so it can be restored after tests.
   * @source
   */
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("should return 400 error if svgUrl parameter is missing", async () => {
    // Create a request without the required "svgUrl"
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

  it("should return error if fetching SVG fails", async () => {
    // Provide a valid request body.
    const req = new Request("http://localhost/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({ svgUrl: "http://localhost/fake.svg" }),
    }) as unknown as NextRequest;

    // Mock fetch to simulate a failed response.
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    });

    const res = await POST(req);
    // The endpoint should forward the status returned by fetch.
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Failed to fetch SVG");
  });

  it("should successfully convert SVG to PNG", async () => {
    const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
    // Provide a valid request with svgUrl.
    const req = new Request("http://localhost/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({ svgUrl: "http://localhost/dummy.svg" }),
    }) as unknown as NextRequest;

    // Mock fetch to return the dummy SVG content.
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => dummySVG,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const rawText = await res.text();
    const data = JSON.parse(rawText);
    // The pngDataUrl should start with the proper data URL prefix.
    expect(data.pngDataUrl).toContain("data:image/png;base64,");
    // Verify that our mocked sharp converted the SVG to PNG.
    const expectedBase64 = Buffer.from("FAKEPNG").toString("base64");
    expect(data.pngDataUrl).toBe(`data:image/png;base64,${expectedBase64}`);
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

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => dummySVG,
    });

    // Override the sharp mock for this test to simulate an error.
    (sharp as unknown as jest.Mock).mockImplementationOnce(() => ({
      png: () => ({ toBuffer: createToBufferFailure() }),
    }));

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Conversion failed");
  });

  it("should increment analytics and return 400 when format is invalid", async () => {
    jest.resetModules();
    const apiModule = await import("@/lib/api-utils");
    const spy = jest.spyOn(apiModule, "incrementAnalytics");
    const { POST } = await import("./route");

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
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid format parameter");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const returned = (
      require("@upstash/redis").Redis.fromEnv as jest.Mock
    ).mock.results.at(-1)?.value;
    expect(returned?.incr).toHaveBeenCalledWith(
      "analytics:convert_api:failed_requests",
    );
    spy.mockRestore();
  });

  describe("SVG sanitization policy", () => {
    /**
     * Default headers used when crafting conversion requests.
     * @source
     */
    const defaultHeaders = {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    };

    /**
     * Constructs a POST `NextRequest` for the convert API using the given SVG URL.
     * @param url - SVG URL to embed in the request payload.
     * @returns Prepared POST request targeting the convert endpoint.
     * @source
     */
    const makeRequestForSvgUrl = (url = "http://localhost/dummy.svg") =>
      new Request("http://localhost/api/convert", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({ svgUrl: url }),
      }) as unknown as NextRequest;

    /**
     * Stubs `fetch` to return controlled SVG responses.
     * @param svg - SVG payload to return.
     * @param ok - Whether the response is considered successful.
     * @param status - HTTP status code to mimic.
     * @source
     */
    const mockFetchSvg = (svg: string, ok = true, status = 200) => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok,
        status,
        text: async () => svg,
      });
    };

    /**
     * Posts sanitized SVG and exposes the buffer captured by `sharp`.
     * @param svg - SVG markup to send to the convert endpoint.
     * @param url - Optional URL to assign when fetching the SVG.
     * @param expectStatus - Expected HTTP status for the POST response.
     * @returns Response and captured SVG buffer contents.
     * @source
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
