import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockExpire,
  sharedRedisMockGet,
  sharedRedisMockLrange,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
  sharedRedisMockSmembers,
  sharedRedisMockSrem,
} from "@/tests/unit/__setup__";

const { GET, POST } = await import("@/app/api/cron/analytics-reporting/route");

const CRON_SECRET = "testsecret";
const BASE_URL = "http://localhost/api/cron/analytics-reporting";

function createCronRequest(
  secret: string | null = CRON_SECRET,
  options?: {
    headers?: Record<string, string>;
    method?: "GET" | "POST";
    searchParams?: Record<string, string>;
    useAuthorizationHeader?: boolean;
  },
): Request {
  const url = new URL(BASE_URL);
  Object.entries(options?.searchParams ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers(options?.headers);

  if (secret) {
    if (options?.useAuthorizationHeader) {
      headers.set("authorization", `Bearer ${secret}`);
    } else {
      headers.set("x-cron-secret", secret);
    }
  }

  return new Request(url, {
    method: options?.method ?? "POST",
    headers,
  });
}

function createRollingWindowCounterValues(options?: {
  captured?: number;
  dropped?: number;
}) {
  const values = Array.from({ length: 48 }, () => null as string | null);

  if (typeof options?.captured === "number") {
    values[0] = String(options.captured);
  }
  if (typeof options?.dropped === "number") {
    values[1] = String(options.dropped);
  }

  return values;
}

function setupAnalyticsData(values: Record<string, string | null>) {
  const keys = Object.keys(values).sort();
  const dataKeys = keys.filter((key) => key !== "analytics:reports");
  sharedRedisMockLrange.mockResolvedValueOnce([]);
  sharedRedisMockLrange.mockResolvedValueOnce([]);
  sharedRedisMockSmembers.mockResolvedValueOnce(keys);
  sharedRedisMockMget.mockResolvedValueOnce(
    dataKeys.map((key) => values[key] ?? null),
  );
  sharedRedisMockMget.mockResolvedValueOnce([null, null]);
  sharedRedisMockMget.mockResolvedValueOnce(createRollingWindowCounterValues());
  sharedRedisMockGet.mockResolvedValueOnce(null);
  sharedRedisMockRpush.mockResolvedValueOnce(1);
  sharedRedisMockLtrim.mockResolvedValueOnce("OK");
  sharedRedisMockExpire.mockResolvedValueOnce(1);
}

async function expectApiErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError: string,
) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get("Content-Type")).toContain("application/json");

  const body = (await response.json()) as {
    error: string;
    status: number;
    category: string;
    retryable: boolean;
    recoverySuggestions: unknown[];
  };

  expect(body).toMatchObject({
    error: expectedError,
    status: expectedStatus,
    category: expect.any(String),
    retryable: expect.any(Boolean),
    recoverySuggestions: expect.any(Array),
  });
}

async function expectSuccessfulReport(response: Response) {
  expect(response.status).toBe(200);
  const report = await response.json();
  expect(report).toHaveProperty("summary");
  expect(report).toHaveProperty("raw_data");
  expect(report).toHaveProperty("generatedAt");
  return report;
}

async function expectSuccessfulReportList(response: Response) {
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload).toHaveProperty("reports");
  expect(payload).toHaveProperty("count");
  expect(payload).toHaveProperty("retentionLimit");
  return payload;
}

describe("Analytics & Reporting Cron API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...process.env,
      CRON_SECRET,
      NODE_ENV: "test",
    };
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
    sharedRedisMockGet.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLrange.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockExpire.mockReset();
    sharedRedisMockSmembers.mockReset();
    sharedRedisMockSrem.mockReset();
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockSmembers.mockResolvedValue([]);
    sharedRedisMockSrem.mockResolvedValue(1);
    sharedRedisMockExpire.mockResolvedValue(1);
  });

  afterEach(() => {
    mock.clearAllMocks();
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
    delete process.env.CRON_SECRET;
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
  });

  it("rejects invalid or missing cron secrets", async () => {
    await expectApiErrorResponse(
      await POST(createCronRequest("wrongsecret")),
      401,
      "Unauthorized",
    );
    await expectApiErrorResponse(
      await POST(createCronRequest(null)),
      401,
      "Unauthorized",
    );
  });

  it("accepts Vercel-style Authorization bearer cron secrets", async () => {
    setupAnalyticsData({ "analytics:visits": "100" });

    const report = await expectSuccessfulReport(
      await POST(
        createCronRequest(CRON_SECRET, { useAuthorizationHeader: true }),
      ),
    );

    expect(report.summary.visits).toBe(100);
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    await expectApiErrorResponse(
      await POST(createCronRequest(null)),
      503,
      "CRON_SECRET is not configured",
    );
  });

  it("allows unsecured cron only when explicitly enabled in development", async () => {
    delete process.env.CRON_SECRET;
    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.ALLOW_UNSECURED_CRON_IN_DEV = "true";
    setupAnalyticsData({ "analytics:visits": "100" });

    const report = await expectSuccessfulReport(
      await POST(createCronRequest(null)),
    );
    expect(report.summary.visits).toBe(100);
  });

  it("groups analytics metrics and filters analytics:reports", async () => {
    setupAnalyticsData({
      "analytics:visits": "100",
      "analytics:api:requests": "5000",
      "analytics:api:errors": "25",
      "analytics:reports": null,
    });

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(report.summary).toMatchObject({
      visits: 100,
      api: {
        requests: 5000,
        errors: 25,
      },
      observability: {
        errorReports: {
          totalCaptured: 0,
          totalDropped: 0,
          retainedTriage: {
            totalReports: 0,
          },
          evictedTriage: {
            totalReports: 0,
          },
        },
      },
    });
    expect(report.raw_data).toEqual({
      "analytics:visits": 100,
      "analytics:api:requests": 5000,
      "analytics:api:errors": 25,
    });
    expect(sharedRedisMockMget).toHaveBeenCalledWith(
      "analytics:api:errors",
      "analytics:api:requests",
      "analytics:visits",
    );
    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "analytics:reports",
      expect.any(String),
    );
    expect(sharedRedisMockLtrim).toHaveBeenCalledWith(
      "analytics:reports",
      -50,
      -1,
    );
  });

  it("echoes X-Request-Id on analytics reporting responses", async () => {
    setupAnalyticsData({ "analytics:visits": "100" });

    const response = await POST(
      new Request(BASE_URL, {
        method: "POST",
        headers: {
          "x-cron-secret": CRON_SECRET,
          "x-request-id": "req-analytics-12345",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req-analytics-12345");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Request-Id",
    );
  });

  it("maps missing values to zero and parses structured JSON values", async () => {
    setupAnalyticsData({
      "analytics:missing_metric": null,
      "analytics:custom": '{"count": 50}',
    });

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );
    expect(report.raw_data["analytics:missing_metric"]).toBe(0);
    expect(report.summary.missing_metric).toBe(0);
    expect(report.raw_data["analytics:custom"]).toEqual({ count: 50 });
    expect(sharedRedisMockSrem).toHaveBeenCalledWith(
      "analytics:reporting:index",
      "analytics:missing_metric",
    );
  });

  it("surfaces error-report ring-buffer saturation metrics in the cron summary", async () => {
    sharedRedisMockLrange.mockResolvedValueOnce([]);
    sharedRedisMockLrange.mockResolvedValueOnce([]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["8", "2"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockGet.mockResolvedValueOnce(null);
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(report.summary.observability).toMatchObject({
      errorReports: {
        capacity: 250,
        retained: 0,
        totalCaptured: 8,
        totalDropped: 2,
        cumulativeSaturationRate: 0.25,
        rollingWindow: {
          bucketCount: 24,
          bucketSizeMs: 3_600_000,
          totalCaptured: 0,
          totalDropped: 0,
          saturationRate: 0,
        },
        retainedTriage: {
          totalReports: 0,
          topRoutes: [],
          topCategories: [],
          topSources: [],
          topUserActions: [],
          recentReports: [],
        },
        evictedTriage: {
          totalReports: 0,
          topRoutes: [],
          topCategories: [],
          topSources: [],
          topUserActions: [],
          recentReports: [],
        },
      },
      alerts: {
        webhookConfigured: false,
        baselineAvailable: false,
        comparisonWindow: "unavailable",
        triggered: false,
        reasons: [],
        minNewReportsThreshold: 25,
        newCapturedSinceLastReport: null,
        newDroppedSinceLastReport: null,
        intervalSaturationRate: null,
        delivery: {
          attempted: false,
          delivered: false,
          skippedReason: "baseline_unavailable",
        },
      },
    });
    expect(
      typeof report.summary.observability.errorReports.rollingWindow
        .windowStart,
    ).toBe("number");
    expect(
      typeof report.summary.observability.errorReports.rollingWindow.windowEnd,
    ).toBe("number");
  });

  it("adds retained and evicted top-N error breakdowns to cron observability summaries", async () => {
    sharedRedisMockLrange.mockResolvedValueOnce([]);
    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        id: "rep-retained-1",
        timestamp: 1_710_000_100_000,
        source: "react_error_boundary",
        userAction: "render_component_tree",
        category: "network_error",
        retryable: true,
        technicalMessage: "Segment render failed after retry",
        errorName: "Error",
        route: "/user/Alex",
        requestId: "req-retained-12345",
        digest: "digest-retained-1",
      }),
      JSON.stringify({
        id: "rep-retained-2",
        timestamp: 1_710_000_200_000,
        source: "client_hook",
        userAction: "bootstrap_user_page",
        category: "server_error",
        retryable: false,
        technicalMessage: "Bootstrap payload missing required shape",
        errorName: "TypeError",
        route: "/user/Alex?tab=cards",
      }),
    ]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["8", "2"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockGet.mockResolvedValueOnce(
      JSON.stringify({
        totalReports: 4,
        updatedAt: 1_710_000_300_000,
        routes: {
          "/user/Alex": {
            reports: 3,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
              route: "/user/Alex",
              requestId: "req-evicted-12345",
              digest: "digest-evicted-1",
            },
          },
        },
        categories: {
          network_error: {
            reports: 4,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
            },
          },
        },
        sources: {
          react_error_boundary: {
            reports: 4,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
            },
          },
        },
        userActions: {
          render_component_tree: {
            reports: 4,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
            },
          },
        },
        recentReports: [
          {
            id: "rep-evicted-1",
            timestamp: 1_710_000_250_000,
            source: "react_error_boundary",
            userAction: "render_component_tree",
            category: "network_error",
            retryable: true,
            technicalMessage: "Earlier incident rolled out of the buffer",
            errorName: "Error",
          },
        ],
      }),
    );
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(
      report.summary.observability.errorReports.retainedTriage,
    ).toMatchObject({
      totalReports: 2,
    });
    expect(
      report.summary.observability.errorReports.retainedTriage.topRoutes.some(
        (bucket: {
          value: string;
          reports: number;
          latest?: {
            requestId?: string;
            digest?: string;
          };
        }) =>
          bucket.value === "/user/Alex" &&
          bucket.reports === 1 &&
          bucket.latest?.requestId === "req-retained-12345" &&
          bucket.latest?.digest === "digest-retained-1",
      ),
    ).toBe(true);
    expect(
      report.summary.observability.errorReports.evictedTriage,
    ).toMatchObject({
      totalReports: 4,
      updatedAt: 1_710_000_300_000,
    });
    expect(
      report.summary.observability.errorReports.evictedTriage.topCategories[0],
    ).toMatchObject({
      value: "network_error",
      reports: 4,
    });
  });

  it("sends a webhook alert for error spikes and saturation without blocking report creation", async () => {
    process.env.ERROR_ALERT_WEBHOOK_URL =
      "https://hooks.example.test/services/error-spikes";
    const recentGeneratedAt = new Date(
      Date.now() - 60 * 60 * 1000,
    ).toISOString();
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        summary: {
          observability: {
            errorReports: {
              capacity: 250,
              retained: 5,
              totalCaptured: 5,
              totalDropped: 0,
              cumulativeSaturationRate: 0,
            },
          },
        },
        raw_data: {},
        generatedAt: recentGeneratedAt,
      }),
    ]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["40", "3"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.example.test/services/error-spikes",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(report.summary.observability.alerts).toEqual({
      webhookConfigured: true,
      baselineAvailable: true,
      comparisonWindow: "report_interval",
      triggered: true,
      reasons: ["error_spike", "ring_buffer_saturation"],
      minNewReportsThreshold: 25,
      newCapturedSinceLastReport: 35,
      newDroppedSinceLastReport: 3,
      intervalSaturationRate: 0.0857,
      delivery: {
        attempted: true,
        delivered: true,
        destinationHost: "hooks.example.test",
        statusCode: 204,
      },
    });
  });

  it("includes request and operation IDs in webhook alert details when available", async () => {
    process.env.ERROR_ALERT_WEBHOOK_URL =
      "https://hooks.example.test/services/error-spikes";
    const recentGeneratedAt = new Date(
      Date.now() - 60 * 60 * 1000,
    ).toISOString();
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        summary: {
          observability: {
            errorReports: {
              capacity: 250,
              retained: 5,
              totalCaptured: 5,
              totalDropped: 0,
              cumulativeSaturationRate: 0,
            },
          },
        },
        raw_data: {},
        generatedAt: recentGeneratedAt,
      }),
    ]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["40", "3"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    await expectSuccessfulReport(
      await POST(
        createCronRequest(CRON_SECRET, {
          headers: {
            "x-operation-id": "op-analytics-report-12345",
            "x-request-id": "req-analytics-report-12345",
          },
        }),
      ),
    );

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const fetchBody = JSON.parse(
      String((firstFetchCall?.[1] as RequestInit | undefined)?.body),
    ) as {
      details?: {
        operationId?: string;
        requestId?: string;
      };
    };

    expect(fetchBody.details?.operationId).toBe("op-analytics-report-12345");
    expect(fetchBody.details?.requestId).toBe("req-analytics-report-12345");
  });

  it("keeps cron reporting successful when webhook delivery fails", async () => {
    process.env.ERROR_ALERT_WEBHOOK_URL =
      "https://hooks.example.test/services/error-spikes";
    const recentGeneratedAt = new Date(
      Date.now() - 60 * 60 * 1000,
    ).toISOString();
    const fetchMock = mock(() => Promise.reject(new Error("webhook down")));
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        summary: {
          observability: {
            errorReports: {
              capacity: 250,
              retained: 0,
              totalCaptured: 0,
              totalDropped: 0,
              cumulativeSaturationRate: 0,
            },
          },
        },
        raw_data: {},
        generatedAt: recentGeneratedAt,
      }),
    ]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["30", "1"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const response = await POST(createCronRequest());
    const report = await expectSuccessfulReport(response);

    expect(response.status).toBe(200);
    expect(report.summary.observability.alerts.delivery).toEqual({
      attempted: true,
      delivered: false,
      destinationHost: "hooks.example.test",
      failure: "webhook_request_failed",
    });
    expect(report.summary.observability.alerts.comparisonWindow).toBe(
      "report_interval",
    );
  });

  it("falls back to the rolling 24-hour error window when no fresh report baseline exists", async () => {
    process.env.ERROR_ALERT_WEBHOOK_URL =
      "https://hooks.example.test/services/error-spikes";
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    sharedRedisMockLrange.mockResolvedValueOnce([]);
    sharedRedisMockLrange.mockResolvedValueOnce([]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["40", "3"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues({ captured: 28, dropped: 2 }),
    );
    sharedRedisMockGet.mockResolvedValueOnce(null);
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.summary.observability.alerts).toEqual({
      webhookConfigured: true,
      baselineAvailable: false,
      comparisonWindow: "rolling_24h",
      triggered: true,
      reasons: ["error_spike", "ring_buffer_saturation"],
      minNewReportsThreshold: 25,
      newCapturedSinceLastReport: 28,
      newDroppedSinceLastReport: 2,
      intervalSaturationRate: 0.0714,
      delivery: {
        attempted: true,
        delivered: true,
        destinationHost: "hooks.example.test",
        statusCode: 202,
      },
    });
  });

  it("returns 500 when Redis index reads, mget, or report persistence fails", async () => {
    sharedRedisMockSmembers.mockRejectedValueOnce(new Error("smembers failed"));
    await expectApiErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockRejectedValueOnce(new Error("mget failed"));
    await expectApiErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockRpush.mockRejectedValueOnce(new Error("rpush failed"));
    await expectApiErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockRejectedValueOnce(new Error("ltrim failed"));
    await expectApiErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );
  });

  it("stores only aggregate error-buffer history in persisted analytics reports and applies a 14-day TTL", async () => {
    sharedRedisMockLrange.mockResolvedValueOnce([]);
    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        id: "rep-retained-1",
        timestamp: 1_710_000_100_000,
        source: "react_error_boundary",
        userAction: "render_component_tree",
        category: "network_error",
        retryable: true,
        technicalMessage: "Segment render failed after retry",
        errorName: "Error",
      }),
    ]);
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["8", "2"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues({ captured: 6, dropped: 1 }),
    );
    sharedRedisMockGet.mockResolvedValueOnce(null);
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const response = await POST(createCronRequest());
    expect(response.status).toBe(200);

    const storedReportCall = sharedRedisMockRpush.mock.calls.find(
      ([key]) => key === "analytics:reports",
    );
    expect(storedReportCall).toBeDefined();

    const storedReport = JSON.parse(String(storedReportCall?.[1])) as {
      summary?: {
        observability?: {
          errorReports?: Record<string, unknown>;
        };
      };
    };

    expect(storedReport.summary?.observability?.errorReports).toMatchObject({
      capacity: 250,
      retained: 1,
      totalCaptured: 8,
      totalDropped: 2,
      cumulativeSaturationRate: 0.25,
      rollingWindow: {
        bucketCount: 24,
        bucketSizeMs: 3_600_000,
        totalCaptured: 6,
        totalDropped: 1,
        saturationRate: 0.1667,
      },
    });
    expect(
      storedReport.summary?.observability?.errorReports,
    ).not.toHaveProperty("retainedTriage");
    expect(
      storedReport.summary?.observability?.errorReports,
    ).not.toHaveProperty("evictedTriage");
    expect(sharedRedisMockExpire).toHaveBeenCalledWith(
      "analytics:reports",
      14 * 24 * 60 * 60,
    );
  });

  it("returns recent stored analytics reports through GET", async () => {
    const olderRecentGeneratedAt = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const latestGeneratedAt = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        summary: { visits: 10 },
        raw_data: { "analytics:visits": 10 },
        generatedAt: new Date(
          Date.now() - 15 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      }),
      JSON.stringify({
        summary: { visits: 100 },
        raw_data: { "analytics:visits": 100 },
        generatedAt: olderRecentGeneratedAt,
      }),
      JSON.stringify({
        summary: { visits: 250 },
        raw_data: { "analytics:visits": 250 },
        generatedAt: latestGeneratedAt,
      }),
    ]);

    const payload = await expectSuccessfulReportList(
      await GET(
        createCronRequest(CRON_SECRET, {
          method: "GET",
          searchParams: { limit: "2" },
        }),
      ),
    );

    expect(payload).toEqual({
      reports: [
        {
          summary: { visits: 250 },
          raw_data: { "analytics:visits": 250 },
          generatedAt: latestGeneratedAt,
        },
        {
          summary: { visits: 100 },
          raw_data: { "analytics:visits": 100 },
          generatedAt: olderRecentGeneratedAt,
        },
      ],
      count: 2,
      retentionLimit: 50,
    });
    expect(sharedRedisMockLrange).toHaveBeenCalledWith(
      "analytics:reports",
      0,
      -1,
    );
  });

  it("rejects invalid GET limits and reports read failures", async () => {
    const invalidLimitResponse = await GET(
      createCronRequest(CRON_SECRET, {
        method: "GET",
        searchParams: { limit: "abc" },
      }),
    );

    await expectApiErrorResponse(
      invalidLimitResponse,
      400,
      "Invalid limit parameter",
    );

    sharedRedisMockLrange.mockRejectedValueOnce(new Error("lrange failed"));
    const failureResponse = await GET(
      createCronRequest(CRON_SECRET, {
        method: "GET",
        searchParams: { limit: "3" },
      }),
    );

    await expectApiErrorResponse(
      failureResponse,
      500,
      "Failed to fetch analytics reports",
    );
  });
});
