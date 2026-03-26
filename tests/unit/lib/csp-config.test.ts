import { describe, expect, it } from "bun:test";

import { buildCSPHeader } from "@/lib/csp-config";

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
});
