import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockLrange,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
  sharedRedisMockScan,
} from "@/tests/unit/__setup__";

const { GET, POST } = await import("@/app/api/cron/analytics-reporting/route");

const CRON_SECRET = "testsecret";
const BASE_URL = "http://localhost/api/cron/analytics-reporting";

function createCronRequest(
  secret: string | null = CRON_SECRET,
  options?: {
    method?: "GET" | "POST";
    searchParams?: Record<string, string>;
  },
): Request {
  const url = new URL(BASE_URL);
  Object.entries(options?.searchParams ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new Request(url, {
    method: options?.method ?? "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

function setupAnalyticsData(values: Record<string, string | null>) {
  const keys = Object.keys(values);
  sharedRedisMockScan.mockResolvedValueOnce([0, keys]);
  sharedRedisMockMget.mockResolvedValueOnce(
    keys.map((key) => values[key] ?? null),
  );
  sharedRedisMockRpush.mockResolvedValueOnce(1);
  sharedRedisMockLtrim.mockResolvedValueOnce("OK");
}

async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedText: string,
) {
  expect(response.status).toBe(expectedStatus);
  expect(await response.text()).toBe(expectedText);
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
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...process.env,
      CRON_SECRET,
      NODE_ENV: "test",
    };
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
    sharedRedisMockScan.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLrange.mockReset();
    sharedRedisMockLtrim.mockReset();
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
  });

  it("rejects invalid or missing cron secrets", async () => {
    await expectErrorResponse(
      await POST(createCronRequest("wrongsecret")),
      401,
      "Unauthorized",
    );
    await expectErrorResponse(
      await POST(createCronRequest(null)),
      401,
      "Unauthorized",
    );
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    await expectErrorResponse(
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

    expect(report.summary).toEqual({
      visits: 100,
      api: {
        requests: 5000,
        errors: 25,
      },
    });
    expect(report.raw_data).toEqual({
      "analytics:visits": 100,
      "analytics:api:requests": 5000,
      "analytics:api:errors": 25,
    });
    expect(sharedRedisMockMget).toHaveBeenCalledWith(
      "analytics:visits",
      "analytics:api:requests",
      "analytics:api:errors",
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
  });

  it("returns 500 when Redis scan, mget, or report persistence fails", async () => {
    sharedRedisMockScan.mockRejectedValueOnce(new Error("scan failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockScan.mockResolvedValueOnce([0, ["analytics:visits"]]);
    sharedRedisMockMget.mockRejectedValueOnce(new Error("mget failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockScan.mockResolvedValueOnce([0, ["analytics:visits"]]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockRpush.mockRejectedValueOnce(new Error("rpush failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockScan.mockResolvedValueOnce([0, ["analytics:visits"]]);
    sharedRedisMockMget.mockResolvedValueOnce(["100"]);
    sharedRedisMockRpush.mockResolvedValueOnce(1);
    sharedRedisMockLtrim.mockRejectedValueOnce(new Error("ltrim failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );
  });

  it("returns recent stored analytics reports through GET", async () => {
    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        summary: { visits: 100 },
        raw_data: { "analytics:visits": 100 },
        generatedAt: "2026-03-21T10:30:00.000Z",
      }),
      JSON.stringify({
        summary: { visits: 250 },
        raw_data: { "analytics:visits": 250 },
        generatedAt: "2026-03-22T10:30:00.000Z",
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
          generatedAt: "2026-03-22T10:30:00.000Z",
        },
        {
          summary: { visits: 100 },
          raw_data: { "analytics:visits": 100 },
          generatedAt: "2026-03-21T10:30:00.000Z",
        },
      ],
      count: 2,
      retentionLimit: 50,
    });
    expect(sharedRedisMockLrange).toHaveBeenCalledWith(
      "analytics:reports",
      -2,
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

    expect(invalidLimitResponse.status).toBe(400);
    expect(await invalidLimitResponse.json()).toEqual({
      error: "Invalid limit parameter",
    });

    sharedRedisMockLrange.mockRejectedValueOnce(new Error("lrange failed"));
    const failureResponse = await GET(
      createCronRequest(CRON_SECRET, {
        method: "GET",
        searchParams: { limit: "3" },
      }),
    );

    expect(failureResponse.status).toBe(500);
    expect(await failureResponse.json()).toEqual({
      error: "Failed to fetch analytics reports",
    });
  });
});
