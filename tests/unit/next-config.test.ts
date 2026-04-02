import { describe, expect, it } from "bun:test";

import nextConfig from "../../next.config";

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
