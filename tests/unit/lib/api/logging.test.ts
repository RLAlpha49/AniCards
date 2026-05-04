import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  buildPersistedRequestMetadata,
  logPrivacySafe,
  logRequest,
  logSuccess,
} from "@/lib/api/logging";
import {
  ensureRequestContext,
  INTERNAL_REQUEST_ID_HEADER,
} from "@/lib/api/request-context";
import { allowConsoleWarningsAndErrors } from "@/tests/unit/__setup__";

type LogLevel = "log" | "warn" | "error";

type LoggedEntry = {
  context?: Record<string, unknown>;
  endpoint: string;
  level: "info" | "warn" | "error";
  message: string;
  method?: string;
  operationId?: string;
  path?: string;
  requestId?: string;
};

function createRequest(requestId: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      [INTERNAL_REQUEST_ID_HEADER]: requestId,
    },
  });
}

function readLastConsoleJsonLog(level: LogLevel): LoggedEntry {
  const calls = (
    console[level] as unknown as { mock: { calls: Array<[string]> } }
  ).mock.calls;
  const serializedEntry = calls.at(-1)?.[0];

  expect(serializedEntry).toBeTruthy();

  return JSON.parse(String(serializedEntry)) as LoggedEntry;
}

describe("api logging", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost",
      NODE_ENV: "test",
    };
    allowConsoleWarningsAndErrors();
    mock.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.clearAllMocks();
  });

  it("omits persisted request metadata when the client IP bucket is unknown", () => {
    expect(buildPersistedRequestMetadata(" unknown ")).toBeUndefined();
  });

  it("stores only the redacted public IP bucket in persisted request metadata", () => {
    expect(buildPersistedRequestMetadata("198.51.100.24")).toEqual({
      lastSeenIpBucket: "198.51.x.x",
    });
  });

  it("promotes safe context request identifiers to top-level log fields", () => {
    const request = createRequest("req-context-12345");

    ensureRequestContext(request, {
      endpoint: "User API",
      operationId: "op-context-12345",
      path: "/user/Alex",
    });

    logPrivacySafe(
      "error",
      "User API",
      "Failed to load user profile",
      {
        operationId: "op-override-12345",
        requestId: "req-override-12345",
      },
      request,
    );

    const logEntry = readLastConsoleJsonLog("error");

    expect(logEntry.requestId).toBe("req-override-12345");
    expect(logEntry.operationId).toBe("op-override-12345");
    expect(logEntry.context).toBeUndefined();
  });

  it("falls back to request context identifiers when context identifiers are invalid", () => {
    const request = createRequest("req-context-12345");

    ensureRequestContext(request, {
      endpoint: "User API",
      operationId: "op-context-12345",
      path: "/user/Alex?token=secret",
    });

    logPrivacySafe(
      "warn",
      "User API",
      "Failed for alex@example.com via https://example.com/reset?token=super-secret-token-value-1234567890",
      {
        ip: "198.51.100.24",
        note: "email=alex@example.com token=super-secret-token-value-1234567890",
        operationId: "bad op!",
        requestId: "bad id!",
        route: "/user/Alex?session=secret",
        userId: 98765,
      },
      request,
    );

    const logEntry = readLastConsoleJsonLog("warn");
    const serializedLogEntry = JSON.stringify(logEntry);

    expect(logEntry.requestId).toBe("req-context-12345");
    expect(logEntry.operationId).toBe("op-context-12345");
    expect(logEntry.path).toBe("/user/[username]");
    expect(logEntry.context).toEqual({
      ip: "198.51.x.x",
      note: "email=[redacted] token=[redacted]",
      route: "/user/[username]",
      userId: "id:***65",
    });
    expect(logEntry.message).toContain("[redacted-email]");
    expect(logEntry.message).toContain("[redacted-url]");
    expect(serializedLogEntry).not.toContain("alex@example.com");
    expect(serializedLogEntry).not.toContain(
      "super-secret-token-value-1234567890",
    );
  });

  it("logs incoming requests with redacted IP buckets and sanitized details", () => {
    const request = createRequest("req-log-request-12345");

    ensureRequestContext(request, {
      endpoint: "Store Users API",
      path: "/api/store-users?token=secret",
    });

    logRequest(
      "Store Users API",
      "127.0.0.1",
      request,
      "Lookup for alex@example.com",
    );

    const logEntry = readLastConsoleJsonLog("log");
    const serializedLogEntry = JSON.stringify(logEntry);

    expect(logEntry.level).toBe("info");
    expect(logEntry.message).toBe("Incoming request");
    expect(logEntry.requestId).toBe("req-log-request-12345");
    expect(logEntry.path).toBe("/api/store-users");
    expect(logEntry.context).toEqual({
      details: "Lookup for [redacted-email]",
      ip: "loopback",
    });
    expect(serializedLogEntry).not.toContain("alex@example.com");
  });

  it("logs successful requests with the default success message and a redacted user identifier", () => {
    const request = createRequest("req-log-success-12345");

    ensureRequestContext(request, {
      endpoint: "Get User API",
      path: "/user/Alex",
    });

    const durationMs = 275;

    logSuccess("Get User API", 12345, durationMs, undefined, request);

    const logEntry = readLastConsoleJsonLog("log");

    expect(logEntry.message).toBe("Successfully processed request");
    expect(logEntry.path).toBe("/user/[username]");
    expect(logEntry.context).toEqual({
      durationMs,
      userId: "id:***45",
    });
  });
});
