import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import { buildErrorFallbackModel } from "@/components/ErrorBoundary";

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
});
