import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildErrorFallbackModel,
  ErrorFallbackPanel,
} from "@/components/ErrorBoundary";

describe("ErrorBoundary fallback model", () => {
  it("maps raw runtime errors to safe user-facing fallback copy", () => {
    const model = buildErrorFallbackModel(
      new Error("Failed to fetch user Alex profile"),
    );

    expect(model.heading).toBe("Something went wrong");
    expect(model.message).toBe("Network connection error");
    expect(model.retryable).toBe(true);
    expect(
      model.suggestions.some(
        (suggestion) => suggestion.title === "Check your connection",
      ),
    ).toBe(true);
  });

  it("renders a privacy-safe incident reference when provided", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorFallbackPanel, {
        incidentReference: "digest-prod-12345",
      }),
    );

    expect(markup).toContain("Incident reference");
    expect(markup).toContain("digest-prod-12345");
  });
});
