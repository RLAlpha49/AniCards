import { describe, expect, it } from "bun:test";

import {
  buildCSPHeader,
  CSP_DIRECTIVES,
  getImageSrcAllowlist,
} from "@/lib/csp-config";

describe("CSP header builder", () => {
  it("injects the request nonce into script-src", () => {
    const header = buildCSPHeader("abc123");

    expect(header).toContain("script-src 'self'");
    expect(header).toContain("'nonce-abc123'");
  });

  it("uses nonce-backed style-src in production while isolating inline style attributes", () => {
    const header = buildCSPHeader("abc123");
    const styleSrcDirective = header
      .split("; ")
      .find((directive) => directive.startsWith("style-src "));
    const styleSrcAttrDirective = header
      .split("; ")
      .find((directive) => directive.startsWith("style-src-attr "));

    expect(styleSrcDirective).toBeTruthy();
    expect(styleSrcDirective).toContain("'nonce-abc123'");
    expect(styleSrcDirective).toContain("https://fonts.googleapis.com");
    expect(styleSrcDirective).not.toContain("'unsafe-inline'");

    expect(styleSrcAttrDirective).toBeTruthy();
    expect(styleSrcAttrDirective).toBe("style-src-attr 'unsafe-inline'");
  });

  it("allows unsafe-eval only when explicitly enabled", () => {
    const developmentHeader = buildCSPHeader("abc123", {
      allowUnsafeEval: true,
    });
    const productionHeader = buildCSPHeader("abc123");

    expect(developmentHeader).toContain("'unsafe-eval'");
    expect(productionHeader).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-inline styles only when explicitly enabled", () => {
    const developmentHeader = buildCSPHeader("abc123", {
      allowUnsafeInlineStyles: true,
    });
    const productionHeader = buildCSPHeader("abc123");

    const developmentStyleSrcDirective = developmentHeader
      .split("; ")
      .find((directive) => directive.startsWith("style-src "));
    const productionStyleSrcDirective = productionHeader
      .split("; ")
      .find((directive) => directive.startsWith("style-src "));

    expect(developmentStyleSrcDirective).toBeTruthy();
    expect(developmentStyleSrcDirective).toContain("'unsafe-inline'");
    expect(productionStyleSrcDirective).toBeTruthy();
    expect(productionStyleSrcDirective).not.toContain("'unsafe-inline'");
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

  it("allows the canonical api subdomain derived from NEXT_PUBLIC_API_URL", () => {
    const allowlist = getImageSrcAllowlist({
      apiUrl: "http://localhost:3000",
      nodeEnv: "production",
    });

    expect(allowlist).toContain("http://localhost:3000");
    expect(allowlist).toContain("http://api.localhost:3000");
    expect(
      allowlist.filter((origin) => origin === "http://api.localhost:3000"),
    ).toHaveLength(1);
  });
});
