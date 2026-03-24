import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  sharedRedisMockGet,
  sharedRedisMockRpush,
  sharedRedisMockScan,
} from "@/tests/unit/__setup__";

const { POST } = await import("@/app/api/cron/analytics-reporting/route");

const CRON_SECRET = "testsecret";
const BASE_URL = "http://localhost/api/cron/analytics-reporting";

function createCronRequest(secret: string | null = CRON_SECRET): Request {
  return new Request(BASE_URL, {
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

function setupAnalyticsData(values: Record<string, string | null>) {
  sharedRedisMockScan.mockResolvedValueOnce([0, Object.keys(values)]);
  sharedRedisMockGet.mockImplementation((key: string) =>
    Promise.resolve(values[key] ?? null),
  );
  sharedRedisMockRpush.mockResolvedValueOnce(1);
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

describe("Analytics & Reporting Cron API", () => {
  beforeEach(() => {
    process.env = {
      ...process.env,
      CRON_SECRET,
      NODE_ENV: "test",
    };
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
    sharedRedisMockScan.mockReset();
    sharedRedisMockGet.mockReset();
    sharedRedisMockRpush.mockReset();
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
    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "analytics:reports",
      expect.any(String),
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

  it("returns 500 when Redis scan, get, or report persistence fails", async () => {
    sharedRedisMockScan.mockRejectedValueOnce(new Error("scan failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockScan.mockResolvedValueOnce([0, ["analytics:visits"]]);
    sharedRedisMockGet.mockRejectedValueOnce(new Error("get failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );

    sharedRedisMockScan.mockResolvedValueOnce([0, ["analytics:visits"]]);
    sharedRedisMockGet.mockResolvedValueOnce("100");
    sharedRedisMockRpush.mockRejectedValueOnce(new Error("rpush failed"));
    await expectErrorResponse(
      await POST(createCronRequest()),
      500,
      "Analytics and reporting job failed",
    );
  });
});
