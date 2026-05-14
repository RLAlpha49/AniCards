import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { INTERNAL_REQUEST_ID_HEADER } from "@/lib/api/request-context";
import {
  allowConsoleWarningsAndErrors,
  parseRequestInitJson,
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
const compareAlphabetically = (left: string, right: string) =>
  left.localeCompare(right);

function parseJsonString<T>(value: unknown, label: string): T {
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${label} to be a JSON string.`);
  }

  return JSON.parse(value) as T;
}

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

function mockAnalyticsReportingLrange(options?: {
  errorReports?: unknown[];
  storedReports?: unknown[];
}) {
  sharedRedisMockLrange.mockImplementation(async (key: string) => {
    if (key === "analytics:reports") {
      return options?.storedReports ?? [];
    }

    if (key === "telemetry:error-reports:v1") {
      return options?.errorReports ?? [];
    }

    return [];
  });
}

function mockAnalyticsReportingGet(options?: {
  alertSuppression?: {
    suppressedUntil?: string;
  } | null;
  evictedSummary?: unknown;
  refreshBatchSnapshot?: unknown;
  telemetryWriteHealth?: unknown;
}) {
  sharedRedisMockGet.mockImplementation((key: string) => {
    if (key === "telemetry:error-reports:v1:evicted-summary") {
      return Promise.resolve(options?.evictedSummary ?? null);
    }

    if (key === "analytics:telemetry:write_health") {
      return Promise.resolve(options?.telemetryWriteHealth ?? null);
    }

    if (key === "analytics:cron_job:refresh_batch_last_run") {
      return Promise.resolve(options?.refreshBatchSnapshot ?? null);
    }

    if (key.startsWith("analytics:error-alert:fingerprint:")) {
      return Promise.resolve(
        options?.alertSuppression
          ? JSON.stringify(options.alertSuppression)
          : null,
      );
    }

    return Promise.resolve(null);
  });
}

function setupAnalyticsData(values: Record<string, string | null>) {
  const keys = Object.keys(values).sort(compareAlphabetically);
  const dataKeys = keys.filter((key) => key !== "analytics:reports");
  mockAnalyticsReportingLrange();
  sharedRedisMockSmembers.mockResolvedValueOnce(keys);
  sharedRedisMockMget.mockResolvedValueOnce(
    dataKeys.map((key) => values[key] ?? null),
  );
  sharedRedisMockMget.mockResolvedValueOnce([null, null]);
  sharedRedisMockMget.mockResolvedValueOnce(createRollingWindowCounterValues());
  mockAnalyticsReportingGet();
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
  expect(report).toHaveProperty("generatedAt");
  expect(report).toHaveProperty("reportMeta");
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
      "Server misconfigured",
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
        analyticsRead: {
          includedKeyCount: 3,
          state: "ok",
          totalIndexedKeyCount: 3,
          truncatedKeyCount: 0,
        },
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
    expect(report.raw_data).toBeUndefined();
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

  it("returns the forwarded X-Request-Id on analytics reporting responses", async () => {
    setupAnalyticsData({ "analytics:visits": "100" });

    const response = await POST(
      new Request(BASE_URL, {
        method: "POST",
        headers: {
          "x-cron-secret": CRON_SECRET,
          [INTERNAL_REQUEST_ID_HEADER]: "req-analytics-12345",
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
      await POST(
        createCronRequest(CRON_SECRET, {
          searchParams: { includeRaw: "1" },
        }),
      ),
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
    mockAnalyticsReportingLrange();
    mockAnalyticsReportingGet();
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["8", "2"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(report.summary.observability).toMatchObject({
      analyticsRead: {
        includedKeyCount: 1,
        state: "ok",
        totalIndexedKeyCount: 1,
        truncatedKeyCount: 0,
      },
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
      refreshBatch: {
        state: "unavailable",
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
    mockAnalyticsReportingLrange({
      errorReports: [
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
      ],
    });
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["8", "2"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    mockAnalyticsReportingGet({
      evictedSummary: JSON.stringify({
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
    });
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

  it("surfaces explicit degraded observability when the error-report buffer cannot be read", async () => {
    mockAnalyticsReportingLrange({
      storedReports: [],
    });
    sharedRedisMockLrange.mockImplementation(async (key: string) => {
      if (key === "analytics:reports") {
        return [];
      }

      if (key === "telemetry:error-reports:v1") {
        throw new Error("buffer unavailable");
      }

      return [];
    });
    mockAnalyticsReportingGet();
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(report.summary.observability).toMatchObject({
      errorReports: {
        degraded: true,
        failure: "error_report_buffer_unavailable",
        state: "degraded",
      },
      refreshBatch: {
        state: "unavailable",
      },
      alerts: {
        delivery: {
          attempted: false,
          delivered: false,
          skippedReason: "error_report_buffer_unavailable",
        },
      },
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

    mockAnalyticsReportingLrange({
      storedReports: [
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
      ],
    });
    mockAnalyticsReportingGet();
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
        fingerprint: expect.any(String),
        statusCode: 204,
        suppressedUntil: expect.any(String),
      },
    });
    expect(report.reportMeta.alertDelivery).toMatchObject({
      attempted: true,
      delivered: true,
      fingerprint: expect.any(String),
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

    mockAnalyticsReportingLrange({
      storedReports: [
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
      ],
    });
    mockAnalyticsReportingGet();
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
            [INTERNAL_REQUEST_ID_HEADER]: "req-analytics-report-12345",
          },
        }),
      ),
    );

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const fetchBody = parseRequestInitJson<{
      details?: {
        operationId?: string;
        requestId?: string;
      };
    }>(firstFetchCall?.[1] as RequestInit | undefined);

    expect(fetchBody.details?.operationId).toBe("op-analytics-report-12345");
    expect(fetchBody.details?.requestId).toBe("req-analytics-report-12345");
  });

  it("minimizes webhook alert payloads to aggregate error-buffer counts", async () => {
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

    mockAnalyticsReportingLrange({
      storedReports: [
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
      ],
    });
    mockAnalyticsReportingGet();
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["40", "3"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    await expectSuccessfulReport(await POST(createCronRequest()));

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const fetchBody = parseRequestInitJson<{
      details?: {
        errorReportBuffer?: Record<string, unknown>;
        errorReports?: unknown;
      };
    }>(firstFetchCall?.[1] as RequestInit | undefined);

    expect(fetchBody.details?.errorReportBuffer).toEqual({
      capacity: 250,
      retained: 0,
      totalCaptured: 40,
      totalDropped: 3,
      cumulativeSaturationRate: 0.075,
    });
    expect(fetchBody.details).not.toHaveProperty("errorReports");
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

    mockAnalyticsReportingLrange({
      storedReports: [
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
      ],
    });
    mockAnalyticsReportingGet();
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
      fingerprint: expect.any(String),
    });
    expect(report.summary.observability.alerts.comparisonWindow).toBe(
      "report_interval",
    );
  });

  it("suppresses duplicate webhook alerts across runs and exposes the suppression state in history", async () => {
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

    mockAnalyticsReportingLrange({
      storedReports: [
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
      ],
    });
    mockAnalyticsReportingGet({
      alertSuppression: {
        suppressedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.summary.observability.alerts.delivery).toMatchObject({
      attempted: false,
      delivered: false,
      destinationHost: "hooks.example.test",
      fingerprint: expect.any(String),
      skippedReason: "duplicate_suppressed",
      suppressedUntil: expect.any(String),
    });
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

    mockAnalyticsReportingLrange();
    mockAnalyticsReportingGet();
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["40", "3"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues({ captured: 28, dropped: 2 }),
    );
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
        fingerprint: expect.any(String),
        statusCode: 202,
        suppressedUntil: expect.any(String),
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
    mockAnalyticsReportingLrange({
      errorReports: [
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
      ],
    });
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["8", "2"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues({ captured: 6, dropped: 1 }),
    );
    mockAnalyticsReportingGet();
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const response = await POST(createCronRequest());
    expect(response.status).toBe(200);

    const storedReportCall = sharedRedisMockRpush.mock.calls.find(
      ([key]) => key === "analytics:reports",
    );
    expect(storedReportCall).toBeDefined();

    const storedReport = parseJsonString<{
      raw_data?: Record<string, unknown>;
      reportMeta?: {
        alertDelivery?: Record<string, unknown>;
        durationMs?: number;
      };
      summary?: {
        observability?: {
          errorReports?: Record<string, unknown>;
        };
      };
    }>(storedReportCall?.[1], "stored analytics report");

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
      retainedTriage: {
        totalReports: 1,
      },
      evictedTriage: {
        totalReports: 0,
      },
    });
    expect(storedReport.raw_data).toBeUndefined();
    expect(storedReport.reportMeta).toMatchObject({
      durationMs: expect.any(Number),
      alertDelivery: expect.any(Object),
    });
    expect(sharedRedisMockExpire).toHaveBeenCalledWith(
      "analytics:reports",
      14 * 24 * 60 * 60,
    );
  });

  it("surfaces degraded telemetry snapshot reads instead of silently looking healthy", async () => {
    mockAnalyticsReportingLrange();
    sharedRedisMockSmembers.mockResolvedValueOnce(["analytics:visits"]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockMget.mockResolvedValueOnce(["0", "0"]);
    sharedRedisMockMget.mockResolvedValueOnce(
      createRollingWindowCounterValues(),
    );
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "analytics:telemetry:write_health") {
        throw new Error("telemetry snapshot unavailable");
      }

      if (key === "analytics:cron_job:refresh_batch_last_run") {
        return Promise.resolve("{not-json");
      }

      if (key === "telemetry:error-reports:v1:evicted-summary") {
        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    });
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockResolvedValueOnce("OK");
    sharedRedisMockExpire.mockResolvedValueOnce(1);

    const report = await expectSuccessfulReport(
      await POST(createCronRequest()),
    );

    expect(report.summary.observability.telemetry).toMatchObject({
      degraded: true,
      failure: "telemetry_write_health_unavailable",
      state: "degraded",
    });
    expect(report.summary.observability.refreshBatch).toMatchObject({
      degraded: true,
      failure: "cron_refresh_snapshot_invalid",
      state: "degraded",
    });
  });

  it("can opt into raw analytics payloads while keeping summary-first responses the default", async () => {
    setupAnalyticsData({ "analytics:visits": "100" });

    const report = await expectSuccessfulReport(
      await POST(
        createCronRequest(CRON_SECRET, {
          searchParams: { includeRaw: "true" },
        }),
      ),
    );

    expect(report.raw_data).toEqual({
      "analytics:visits": 100,
    });
  });

  it("returns recent stored analytics reports through GET", async () => {
    const olderRecentGeneratedAt = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const latestGeneratedAt = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    mockAnalyticsReportingLrange({
      storedReports: [
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
          reportMeta: {
            alertDelivery: {
              attempted: false,
              delivered: false,
            },
            durationMs: 15,
          },
          generatedAt: olderRecentGeneratedAt,
        }),
        JSON.stringify({
          summary: { visits: 250 },
          reportMeta: {
            alertDelivery: {
              attempted: false,
              delivered: false,
            },
            durationMs: 10,
          },
          generatedAt: latestGeneratedAt,
        }),
      ],
    });

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
          reportMeta: {
            alertDelivery: {
              attempted: false,
              delivered: false,
            },
            durationMs: 10,
          },
          generatedAt: latestGeneratedAt,
        },
        {
          summary: { visits: 100 },
          reportMeta: {
            alertDelivery: {
              attempted: false,
              delivered: false,
            },
            durationMs: 15,
          },
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
    expect(sharedRedisMockLtrim).not.toHaveBeenCalled();
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
