import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  getResponseErrorMessage,
  getStructuredResponseError,
} from "@/lib/utils";

describe("structured response error parsing", () => {
  it("preserves structured API error facts and request IDs from JSON payloads", () => {
    const payload = {
      error:
        "Conflict: data was updated elsewhere. Please reload and try again.",
      category: "conflict",
      retryable: false,
      status: 409,
      recoverySuggestions: [
        {
          title: "Reload the page",
          description: "Refresh the page to load the latest saved data.",
          actionLabel: "Reload",
        },
      ],
      currentUpdatedAt: "2026-04-02T12:34:56.000Z",
    };
    const response = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "req-structured-12345",
      },
      status: 409,
      statusText: "Conflict",
    });

    const error = getStructuredResponseError(response, payload);

    expect(error).toEqual({
      message: payload.error,
      status: 409,
      category: "conflict",
      retryable: false,
      recoverySuggestions: payload.recoverySuggestions,
      requestId: "req-structured-12345",
      additionalFields: {
        currentUpdatedAt: "2026-04-02T12:34:56.000Z",
      },
    });
    expect(getResponseErrorMessage(response, payload)).toBe(payload.error);
  });

  it("falls back to derived categories and retryability for unstructured payloads", () => {
    const response = new Response("Upstream gateway failed", {
      headers: {
        "Content-Type": "text/plain",
        "X-Request-Id": "req-fallback-67890",
      },
      status: 503,
      statusText: "Service Unavailable",
    });

    const error = getStructuredResponseError(
      response,
      "Upstream gateway failed",
    );

    expect(error.message).toBe("Upstream gateway failed");
    expect(error.status).toBe(503);
    expect(error.category).toBe("server_error");
    expect(error.retryable).toBe(true);
    expect(error.requestId).toBe("req-fallback-67890");
    expect(error.recoverySuggestions.length).toBeGreaterThan(0);
    expect(error.additionalFields).toBeUndefined();
  });

  it("derives explicit forbidden and validation categories from status codes", () => {
    const forbidden = getStructuredResponseError(
      new Response("Protected request required", {
        status: 403,
        statusText: "Forbidden",
      }),
      "Protected request required",
    );
    const validation = getStructuredResponseError(
      new Response("Validation failed", {
        status: 422,
        statusText: "Unprocessable Entity",
      }),
      "Validation failed",
    );

    expect(forbidden.category).toBe("forbidden");
    expect(forbidden.retryable).toBe(false);
    expect(validation.category).toBe("validation_error");
    expect(validation.retryable).toBe(false);
  });
});
