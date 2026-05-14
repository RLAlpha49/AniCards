import { afterAll, describe, expect, it } from "bun:test";

const DEFAULT_API_URL = "http://localhost:3000";
const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;

process.env.NEXT_PUBLIC_API_URL = DEFAULT_API_URL;

const { default: nextConfig, getRequiredNextPublicApiUrl } =
  await import("../../next.config");

afterAll(() => {
  if (previousApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
    return;
  }

  process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
});

describe("next.config NEXT_PUBLIC_API_URL contract", () => {
  it("fails fast when NEXT_PUBLIC_API_URL is missing", () => {
    expect(() => getRequiredNextPublicApiUrl({ NODE_ENV: "test" })).toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
  });

  it("fails fast when NEXT_PUBLIC_API_URL is not an absolute http(s) URL", () => {
    expect(() =>
      getRequiredNextPublicApiUrl({
        NODE_ENV: "test",
        NEXT_PUBLIC_API_URL: "/api",
      }),
    ).toThrow(/absolute http\(s\) URL/i);
  });

  it("accepts an absolute http(s) NEXT_PUBLIC_API_URL", () => {
    expect(
      getRequiredNextPublicApiUrl({
        NODE_ENV: "test",
        NEXT_PUBLIC_API_URL: DEFAULT_API_URL,
      }),
    ).toBe(DEFAULT_API_URL);
  });
});

describe("next.config static headers", () => {
  it("enforces HSTS across the currently served anicards subdomain surface", async () => {
    const headerRules = await nextConfig.headers?.();

    expect(headerRules).toBeDefined();

    const globalHeaders = headerRules?.find(
      (rule) => rule.source === "/:path*",
    )?.headers;
    const hstsHeader = globalHeaders?.find(
      (header) => header.key === "Strict-Transport-Security",
    );

    expect(hstsHeader?.value).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
  });
});

describe("next.config rewrites", () => {
  it("keeps the legacy card aliases pointed at the canonical card handler", async () => {
    const rewriteRules = await nextConfig.rewrites?.();

    expect(rewriteRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/card.svg",
          destination: "/api/card",
        }),
        expect.objectContaining({
          source: "/api/card.svg",
          destination: "/api/card",
        }),
      ]),
    );
  });
});
