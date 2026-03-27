import { describe, expect, it } from "bun:test";

import { buildCSPHeader, CSP_DIRECTIVES } from "@/lib/csp-config";

describe("CSP header builder", () => {
  it("injects the request nonce into script-src", () => {
    const header = buildCSPHeader("abc123");

    expect(header).toContain("script-src 'self'");
    expect(header).toContain("'nonce-abc123'");
  });

  it("allows unsafe-eval only when explicitly enabled", () => {
    const developmentHeader = buildCSPHeader("abc123", {
      allowUnsafeEval: true,
    });
    const productionHeader = buildCSPHeader("abc123");

    expect(developmentHeader).toContain("'unsafe-eval'");
    expect(productionHeader).not.toContain("'unsafe-eval'");
  });

  it("blocks object embeds and restricts image sources to explicit origins", () => {
    const header = buildCSPHeader("abc123");
    const imgSrcDirective = header
      .split("; ")
      .find((directive) => directive.startsWith("img-src "));

    expect(CSP_DIRECTIVES.imgSrc).toContain("https://api.anicards.alpha49.com");
    expect(CSP_DIRECTIVES.imgSrc).toContain("https://img.anili.st");
    expect(CSP_DIRECTIVES.imgSrc).not.toContain("https:");
    expect(imgSrcDirective).toBeTruthy();
    expect(header).toContain("object-src 'none'");
    expect(imgSrcDirective).not.toMatch(/\shttps:(?=[\s;]|$)/);
  });
});
