import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  redactIp,
  redactUserIdentifier,
  sanitizeErrorReportMetadata,
  sanitizeErrorReportStackTrace,
  sanitizeErrorReportText,
  sanitizePrivacySafeLogValue,
} from "@/lib/error-report-sanitization";

describe("error-report sanitization helpers", () => {
  it("redacts routes, secrets, emails, URLs, and file paths from free-text errors", () => {
    // Arrange
    const message = [
      "Failed to render /user/Alex?q=Fullmetal&visibility=friends",
      "for alex@example.com",
      "from /Users/Alex/private/project/file.ts",
      "after calling https://example.com/reset?token=super-secret-token-value-1234567890",
      "with session=abc123",
    ].join(" ");

    // Act
    const sanitized = sanitizeErrorReportText(message, 500);

    // Assert
    expect(sanitized).toContain("/user/[username]?filter=[redacted]");
    expect(sanitized).toContain("[redacted-email]");
    expect(sanitized).toContain("[redacted-path]");
    expect(sanitized).toContain("[redacted-url]");
    expect(sanitized).toContain("session=[redacted]");
    expect(sanitized).not.toContain("alex@example.com");
    expect(sanitized).not.toContain("super-secret-token-value-1234567890");
    expect(sanitized).not.toContain("/Users/Alex/private/project/file.ts");
  });

  it("keeps only sanitized stack frames and applies frame and total limits", () => {
    // Arrange
    const stack = [
      "BoundaryError: render failed",
      "    at renderBoundary (/Users/Alex/private/project/boundary.tsx:10:5)",
      "    at    fetchProfile    (https://example.com/profile?token=abc:20:2)",
      "caused by upstream detail that should be dropped",
      "    at hydrateView (/tmp/app/render.ts:1:1)",
    ].join("\n");

    // Act
    const sanitized = sanitizeErrorReportStackTrace(stack, {
      frameMaxLength: 20,
      maxFrames: 2,
      separator: " | ",
    });

    // Assert
    expect(sanitized).toBe("at renderBoundary | at fetchProfile");
  });

  it("sanitizes privacy-safe log values by key semantics", () => {
    // Arrange
    const stack = [
      "TypeError: hidden",
      "    at renderBoundary (/Users/Alex/private/project/boundary.tsx:10:5)",
      "    at fetchProfile (https://example.com/profile?token=abc:20:2)",
    ].join("\n");

    // Act
    const routeValue = sanitizePrivacySafeLogValue(
      "route",
      "/user/Alex?q=Fullmetal&visibility=friends",
    );
    const ipValue = sanitizePrivacySafeLogValue("clientIp", "8.8.4.4");
    const userIdValue = sanitizePrivacySafeLogValue("viewerUserId", 123456);
    const requestIdValue = sanitizePrivacySafeLogValue(
      "request_id",
      " req-12345 ",
    );
    const stackValue = sanitizePrivacySafeLogValue("componentStack", stack);

    // Assert
    expect(routeValue).toBe("/user/[username]?filter=search");
    expect(ipValue).toBe("8.8.x.x");
    expect(userIdValue).toBe("id:***56");
    expect(requestIdValue).toBe("req-12345");
    expect(stackValue).toBe("at renderBoundary | at fetchProfile");
  });

  it("drops sensitive metadata keys while preserving safe sanitized values", () => {
    // Arrange
    const metadata = {
      feature:
        "Open https://example.com/private?token=super-secret-token-value-1234567890",
      summary: "Failed in /Users/Alex/private/project/file.ts",
      attempts: 3,
      retryable: false,
      requestId: "req-should-be-dropped",
      email: "alex@example.com",
      route: "/user/Alex",
      token: "super-secret-token-value-1234567890",
    } satisfies Record<string, unknown>;

    // Act
    const sanitized = sanitizeErrorReportMetadata(metadata);

    // Assert
    expect(sanitized).toEqual({
      feature: "Open [redacted-url]",
      summary: "Failed in [redacted-path]",
      attempts: 3,
      retryable: false,
    });
  });

  it("redacts IP addresses and user identifiers into coarse privacy-safe buckets", () => {
    // Arrange
    const publicUserName = "Alpha49";

    // Act
    const loopbackIp = redactIp("127.0.0.1");
    const privateIp = redactIp("192.168.1.20");
    const invalidIp = redactIp("999.1.1.1");
    const ipv6 = redactIp("2001:db8::1");
    const numericId = redactUserIdentifier(42);
    const stringId = redactUserIdentifier(publicUserName);
    const missingId = redactUserIdentifier(undefined);

    // Assert
    expect(loopbackIp).toBe("loopback");
    expect(privateIp).toBe("private_ipv4");
    expect(invalidIp).toBe("invalid_ip");
    expect(ipv6).toBe("ipv6");
    expect(numericId).toBe("id:***42");
    expect(stringId).toBe("Al***(7)");
    expect(missingId).toBe("missing");
  });
});
