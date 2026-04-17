import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("https://anicards.test/user/Alex");

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalNodeEnv = process.env.NODE_ENV;

async function importRealUtils() {
  return await import(new URL("../../../lib/utils.ts", import.meta.url).href);
}

describe("additional utils coverage", () => {
  beforeEach(() => {
    resetHappyDom("https://anicards.test/user/Alex");
    mock.restore();
    console.error = mock(() => undefined) as typeof console.error;
    console.warn = mock(() => undefined) as typeof console.warn;
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(() => {
    restoreHappyDom();
  });

  it("builds absolute API URLs while preserving already absolute inputs", async () => {
    const { buildApiUrl } = await importRealUtils();
    const base = buildApiUrl("").replace(/\/$/, "");

    expect(buildApiUrl("/api/get-user?userId=42")).toBe(
      `${base}/api/get-user?userId=42`,
    );
    expect(buildApiUrl("api/get-user?userId=42")).toBe(
      `${base}/api/get-user?userId=42`,
    );
    expect(buildApiUrl("https://cdn.example.test/api/cards")).toBe(
      "https://cdn.example.test/api/cards",
    );
  });

  it("normalizes preview URLs back to card API hrefs only for http and https URLs", async () => {
    const { toCardApiHref } = await importRealUtils();
    expect(
      toCardApiHref("https://anicards.test/card?type=animeStats&format=svg"),
    ).toBe("/api/card?type=animeStats&format=svg");
    expect(toCardApiHref("/card?type=animeStats&format=svg")).toBe(
      "/api/card?type=animeStats&format=svg",
    );
    expect(
      toCardApiHref("ftp://anicards.test/card?type=animeStats"),
    ).toBeNull();
    expect(toCardApiHref("not a url")).toBe("/api/card");
  });

  it("parses JSON strings, returns pre-parsed data, and logs detailed parse failures in development", async () => {
    const { safeParse } = await importRealUtils();
    expect(safeParse<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
    expect(safeParse<{ ok: boolean }>({ ok: true })).toEqual({ ok: true });

    expect(() => safeParse("{bad json}", "settings-export")).toThrow();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(
      String((console.error as ReturnType<typeof mock>).mock.calls[0]?.[0]),
    ).toContain("Failed to parse JSON [settings-export]");
  });

  it("keeps parse failure logs bounded in production mode", async () => {
    const { safeParse } = await importRealUtils();
    process.env.NODE_ENV = "production";

    expect(() => safeParse("{bad json}", "workspace-backup")).toThrow();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(
      String((console.error as ReturnType<typeof mock>).mock.calls[0]?.[0]),
    ).toContain("Payload length");
  });

  it("resolves relative absolute URLs and extracts render styles with defaults", async () => {
    const { extractStyles, getAbsoluteUrl } = await importRealUtils();
    const expectedAbsoluteUrl = new URL(
      "/api/card?type=animeStats",
      globalThis.location.origin,
    ).toString();

    expect(getAbsoluteUrl("/api/card?type=animeStats")).toBe(
      expectedAbsoluteUrl,
    );
    expect(getAbsoluteUrl("https://cdn.example.test/card.svg")).toBe(
      "https://cdn.example.test/card.svg",
    );
    expect(
      extractStyles({
        animate: true,
        cardName: "animeStats",
        borderColor: "#123456",
        borderRadius: 14,
      }),
    ).toMatchObject({
      animate: true,
      borderColor: "#123456",
      borderRadius: 14,
      titleColor: expect.any(String),
      backgroundColor: expect.any(String),
      textColor: expect.any(String),
      circleColor: expect.any(String),
    });
  });

  it("clamps and validates border radii consistently", async () => {
    const { clampBorderRadius, getCardBorderRadius, validateBorderRadius } =
      await importRealUtils();
    expect(clampBorderRadius(999)).toBe(100);
    expect(clampBorderRadius(-20)).toBe(0);
    expect(clampBorderRadius(Number.NaN)).toBe(8);
    expect(validateBorderRadius(8)).toBe(true);
    expect(validateBorderRadius(101)).toBe(false);
    expect(getCardBorderRadius(12)).toBe(12);
    expect(getCardBorderRadius(undefined, 14)).toBe(14);
  });

  it("escapes XML-sensitive content and brands trusted SVG strings", async () => {
    const { escapeForXml, markTrustedSvg } = await importRealUtils();
    expect(escapeForXml(`Tom & Jerry < "best" > 'duo'`)).toBe(
      "Tom &amp; Jerry &lt; &quot;best&quot; &gt; &apos;duo&apos;",
    );
    expect(markTrustedSvg("<svg />")).toBe(
      "<!--ANICARDS_TRUSTED_SVG--><svg />",
    );
  });

  it("coerces finite numbers with bounded logging for malformed values", async () => {
    const { toFiniteNumber } = await importRealUtils();
    expect(toFiniteNumber(12)).toBe(12);
    expect(toFiniteNumber(" 3.5 ")).toBe(3.5);
    expect(toFiniteNumber("1e3")).toBe(1000);
    expect(toFiniteNumber("", { fallback: 7 })).toBe(7);
    expect(toFiniteNumber("nope", { label: "gridRows" })).toBeNull();
    expect(toFiniteNumber({}, { fallback: 5 })).toBe(5);
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(
      String((console.warn as ReturnType<typeof mock>).mock.calls[1]?.[0]),
    ).toContain("gridRows non-numeric string: nope");
  });
});
