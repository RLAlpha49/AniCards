import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockKeys,
  sharedRedisMockGet,
  sharedRedisMockLrange,
  sharedRedisMockRpush,
} from "@/tests/unit/__setup__.test";

interface ValidationIssue {
  key: string;
  issues: string[];
}

interface ValidationReport {
  summary: string;
  details: Record<string, { checked: number; inconsistencies: number }>;
  issues: ValidationIssue[];
  generatedAt: string;
}

const { POST } = await import("@/app/api/cron/data-validation/route");

/**
 * Dummy cron secret for bypassing authorization in validation tests.
 * @source
 */
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

/**
 * Base URL used when constructing data validation cron requests.
 * @source
 */
const BASE_URL = "http://localhost/api/cron/data-validation";

/**
 * Builds a cron POST request that includes the cron secret header.
 * @param secret - Secret header value to include.
 * @returns Configured Request object for the data validation endpoint.
 * @source
 */
function createCronRequest(secret: string = CRON_SECRET): Request {
  return new Request(BASE_URL, {
    headers: { "x-cron-secret": secret },
  });
}

/**
 * Configures Redis mocks to simulate a healthy validation run.
 * @source
 */
function setupSuccessfulRedisMocks() {
  sharedRedisMockKeys.mockImplementation((pattern: string) => {
    switch (pattern) {
      case "user:*":
        return Promise.resolve(["user:1"]);
      case "cards:*":
        return Promise.resolve(["cards:1"]);
      case "username:*":
        return Promise.resolve(["username:1"]);
      case "analytics:*":
        return Promise.resolve(["analytics:dummy", "analytics:reports"]);
      default:
        return Promise.resolve([]);
    }
  });

  sharedRedisMockGet.mockImplementation((key: string) => {
    if (key === "user:1") {
      return Promise.resolve(JSON.stringify(validUserRecord));
    } else if (key === "cards:1") {
      return Promise.resolve(JSON.stringify(validCardsRecord));
    } else if (key === "username:1") {
      return Promise.resolve("123");
    } else if (key === "analytics:dummy") {
      return Promise.resolve("456");
    }
    return Promise.resolve(null);
  });

  sharedRedisMockLrange.mockImplementation((key: string) => {
    if (key === "analytics:reports") {
      return Promise.resolve([JSON.stringify(validReport)]);
    }
    return Promise.resolve([]);
  });

  sharedRedisMockRpush.mockResolvedValue(1);
}

/**
 * Asserts the response contains a valid validation report and returns it.
 * @param response - HTTP response returned by the cron endpoint.
 * @returns Parsed validation report JSON.
 * @source
 */
async function expectValidationReport(
  response: Response,
): Promise<ValidationReport> {
  expect(response.status).toBe(200);

  const report = (await response.json()) as ValidationReport;
  expect(report).toHaveProperty("summary");
  expect(report).toHaveProperty("details");
  expect(report).toHaveProperty("issues");
  expect(report).toHaveProperty("generatedAt");

  return report;
}

/**
 * Asserts that the response matches the expected status code and body.
 * @param response - HTTP response from the cron handler.
 * @param status - Expected HTTP status.
 * @param message - Expected response text.
 * @source
 */
async function expectErrorResponse(
  response: Response,
  status: number,
  message: string,
) {
  expect(response.status).toBe(status);
  const text = await response.text();
  expect(text).toBe(message);
}

/**
 * Returns whether a validation report contains any issue that includes the provided substring.
 */
function reportHasIssueSubstring(
  report: ValidationReport,
  substr: string,
): boolean {
  for (const v of report.issues) {
    for (const issue of v.issues) {
      if (issue.includes(substr)) return true;
    }
  }
  return false;
}

/**
 * Returns whether a validation report contains a specific key with an issue
 * that includes the provided substring.
 */
function reportHasIssueForKeyWithSubstring(
  report: ValidationReport,
  key: string,
  substr: string,
): boolean {
  const k = report.issues.find((i) => i.key === key);
  if (!k) return false;
  return k.issues.some((issue) => issue.includes(substr));
}

/**
 * Returns whether a validation report contains a specific key with an issue
 * that matches the provided regular expression.
 */
function reportHasIssueForKeyWithRegex(
  report: ValidationReport,
  key: string,
  regex: RegExp,
): boolean {
  const k = report.issues.find((i) => i.key === key);
  if (!k) return false;
  return k.issues.some((issue) => regex.test(issue));
}

/**
 * Representative user record used in successful validation scenarios.
 * @source
 */
const validUserRecord = {
  userId: 1,
  username: "testuser",
  ip: "127.0.0.1",
  createdAt: "2021-01-01T00:00:00Z",
  updatedAt: "2021-01-02T00:00:00Z",
  stats: {},
};

/**
 * Representative cards record used in successful validation scenarios.
 * @source
 */
const validCardsRecord = {
  userId: 1,
  cards: [
    {
      cardName: "animeStats",
      variation: "default",
      titleColor: "#000",
      backgroundColor: "#fff",
      textColor: "#333",
      circleColor: "#f00",
    },
  ],
  updatedAt: "2021-01-02T00:00:00Z",
};

/**
 * Representative analytics report used in successful validation scenarios.
 * @source
 */
const validReport = {
  generatedAt: "2021-01-01T00:00:00Z",
  raw_data: { "analytics:visits": 100 },
  summary: { visits: 100 },
};

describe("Data Validation Cron API POST Endpoint", () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  describe("Authorization", () => {
    it("should return 401 Unauthorized when the cron secret is missing", async () => {
      const req = new Request(BASE_URL, { headers: {} });
      const res = await POST(req);
      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should return 401 Unauthorized when the cron secret is invalid", async () => {
      const req = createCronRequest("wrongsecret");
      const res = await POST(req);
      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should return 401 Unauthorized when the cron secret is empty string", async () => {
      const req = createCronRequest("");
      const res = await POST(req);
      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should proceed when the cron secret is correct", async () => {
      setupSuccessfulRedisMocks();
      const req = createCronRequest(CRON_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("Successful Validation", () => {
    it("should generate a data validation report successfully with no issues", async () => {
      setupSuccessfulRedisMocks();

      const req = createCronRequest();
      const res = await POST(req);

      const report = await expectValidationReport(res);

      // Verify no issues occurred
      expect(report.issues.length).toBe(0);

      // Check details for each pattern
      expect(report.details["user:*"]).toEqual({
        checked: 1,
        inconsistencies: 0,
      });
      expect(report.details["cards:*"]).toEqual({
        checked: 1,
        inconsistencies: 0,
      });
      expect(report.details["username:*"]).toEqual({
        checked: 1,
        inconsistencies: 0,
      });
      expect(report.details["analytics:*"]).toEqual({
        checked: 2,
        inconsistencies: 0,
      });

      // Verify that the report was saved to the Redis list
      expect(sharedRedisMockRpush).toHaveBeenCalledWith(
        "data_validation:reports",
        expect.any(String),
      );
    });

    it("should handle empty pattern results", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([]) // user:*
        .mockResolvedValueOnce([]) // cards:*
        .mockResolvedValueOnce([]) // username:*
        .mockResolvedValueOnce([]); // analytics:*
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.details["user:*"]).toEqual({
        checked: 0,
        inconsistencies: 0,
      });
      expect(report.issues.length).toBe(0);
    });

    it("should handle multiple valid records across all patterns", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1", "user:2", "user:3"])
        .mockResolvedValueOnce(["cards:1", "cards:2"])
        .mockResolvedValueOnce(["username:1", "username:2"])
        .mockResolvedValueOnce(["analytics:data", "analytics:reports"]);
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("user:"))
          return Promise.resolve(JSON.stringify(validUserRecord));
        if (key.startsWith("cards:"))
          return Promise.resolve(JSON.stringify(validCardsRecord));
        if (key.startsWith("username:")) return Promise.resolve("123");
        if (key === "analytics:data") return Promise.resolve("456");
        return Promise.resolve(null);
      });
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(validReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.details["user:*"].checked).toBe(3);
      expect(report.details["cards:*"].checked).toBe(2);
      expect(report.details["username:*"].checked).toBe(2);
      expect(report.issues.length).toBe(0);
    });
  });

  describe("User Record Validation", () => {
    it("should report missing userId", async () => {
      const invalidUser = { ...validUserRecord, userId: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.issues.some((i) => i.key === "user:1")).toBeTruthy();
      expect(
        report.issues
          .find((i) => i.key === "user:1")
          ?.issues.some((issue: string) => issue.includes("userId")),
      ).toBeTruthy();
    });

    it("should report non-number userId", async () => {
      const invalidUser = { ...validUserRecord, userId: "1" };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "userId")).toBeTruthy();
    });

    it("should report missing username", async () => {
      const invalidUser = { ...validUserRecord, username: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "username")).toBeTruthy();
    });

    it("should report missing ip", async () => {
      const invalidUser = { ...validUserRecord, ip: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "ip")).toBeTruthy();
    });

    it("should report missing createdAt", async () => {
      const invalidUser = { ...validUserRecord, createdAt: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "createdAt")).toBeTruthy();
    });

    it("should report missing updatedAt", async () => {
      const invalidUser = { ...validUserRecord, updatedAt: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "updatedAt")).toBeTruthy();
    });

    it("should report missing stats object", async () => {
      const invalidUser = { ...validUserRecord, stats: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "stats")).toBeTruthy();
    });

    it("should report null stats object", async () => {
      const invalidUser = { ...validUserRecord, stats: null };
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidUser));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "stats")).toBeTruthy();
    });
  });

  describe("Cards Record Validation", () => {
    it("should report missing userId in cards", async () => {
      const invalidCards = { ...validCardsRecord, userId: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "userId")).toBeTruthy();
    });

    it("should report non-number userId in cards", async () => {
      const invalidCards = { ...validCardsRecord, userId: "1" };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "userId")).toBeTruthy();
    });

    it("should report missing cards array", async () => {
      const invalidCards = { ...validCardsRecord, cards: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "cards")).toBeTruthy();
    });

    it("should report non-array cards field", async () => {
      const invalidCards = { ...validCardsRecord, cards: "not-an-array" };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "cards")).toBeTruthy();
    });

    it("should report missing card object in array", async () => {
      const invalidCards = { ...validCardsRecord, cards: [null] };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "cards[0]")).toBeTruthy();
    });

    it("should report missing cardName in card", async () => {
      const invalidCards = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], cardName: undefined }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "cardName")).toBeTruthy();
    });

    it("should report missing variation in card", async () => {
      const invalidCards = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], variation: undefined }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(reportHasIssueSubstring(report, "variation")).toBeTruthy();
    });

    it("should accept cards that use a named color preset and lack individual color fields", async () => {
      const cardsRecordWithPreset = {
        userId: 1,
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "default",
          },
        ],
        updatedAt: "2021-01-02T00:00:00Z",
      };

      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify(cardsRecordWithPreset),
      );
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);
      expect(report.issues.length).toBe(0);
    });

    it("should report missing colors when colorPreset is not present", async () => {
      const cardsMissingColors = {
        userId: 1,
        cards: [{ cardName: "animeStats", variation: "default" }],
        updatedAt: "2021-01-02T00:00:00Z",
      };

      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify(cardsMissingColors),
      );
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);
      expect(report.issues.length).toBeGreaterThan(0);
      const cardsIssues = report.issues.find((i) => i.key === "cards:1");
      expect(cardsIssues).toBeDefined();
      expect(
        cardsIssues!.issues.some((m: string) => m.includes("titleColor")),
      ).toBeTruthy();
    });

    it("should report missing colors when colorPreset is 'custom'", async () => {
      const cardsMissingColors = {
        userId: 1,
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "custom",
          },
        ],
        updatedAt: "2021-01-02T00:00:00Z",
      };

      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify(cardsMissingColors),
      );
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it("should report missing titleColor", async () => {
      const invalidCards = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], titleColor: undefined }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "titleColor"),
      ).toBeTruthy();
    });

    it("should report missing backgroundColor", async () => {
      const invalidCards = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], backgroundColor: undefined }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "backgroundColor"),
      ).toBeTruthy();
    });

    it("should report missing textColor", async () => {
      const invalidCards = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], textColor: undefined }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "textColor"),
      ).toBeTruthy();
    });

    it("should report missing circleColor", async () => {
      const invalidCards = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], circleColor: undefined }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "circleColor"),
      ).toBeTruthy();
    });

    it("should accept valid borderColor when provided", async () => {
      const cardsWithBorder = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], borderColor: "#ccc" }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardsWithBorder));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);
      expect(report.issues.length).toBe(0);
    });

    it("should report invalid borderColor when not a string", async () => {
      const cardsInvalidBorder = {
        ...validCardsRecord,
        cards: [{ ...validCardsRecord.cards[0], borderColor: 123 }],
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify(cardsInvalidBorder),
      );
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "borderColor"),
      ).toBeTruthy();
    });

    it("should report missing updatedAt in cards", async () => {
      const invalidCards = { ...validCardsRecord, updatedAt: undefined };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(invalidCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "updatedAt"),
      ).toBeTruthy();
    });

    it("should handle multiple cards with mixed validity", async () => {
      const multipleCards = {
        userId: 1,
        cards: [
          validCardsRecord.cards[0],
          { cardName: "invalid", variation: "default" },
        ],
        updatedAt: "2021-01-02T00:00:00Z",
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(multipleCards));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.issues.length).toBeGreaterThan(0);
      expect(
        reportHasIssueForKeyWithSubstring(report, "cards:1", "cards[1]"),
      ).toBeTruthy();
    });
  });

  describe("Username Record Validation", () => {
    it("should accept numeric username records", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["username:1"])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce("123");
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.issues.length).toBe(0);
    });

    it("should report non-numeric username records", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["username:1"])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify("not-a-number"));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "username:1", "not a number"),
      ).toBeTruthy();
    });

    it("should report object username records", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["username:1"])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify({ id: 1 }));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.issues.some((i) => i.key === "username:1")).toBeTruthy();
    });
  });

  describe("Analytics Validation", () => {
    it("should accept numeric analytics metrics", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:visits", "analytics:reports"]);
      sharedRedisMockGet.mockResolvedValueOnce("100");
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(validReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.issues.length).toBe(0);
    });

    it("should report non-numeric analytics metrics", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:invalid", "analytics:reports"]);
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify("not-a-number"));
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(validReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        report.issues.some((i) => i.key === "analytics:invalid"),
      ).toBeTruthy();
    });

    it("should handle empty analytics reports list", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockLrange.mockResolvedValueOnce([]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "analytics:reports", "empty"),
      ).toBeTruthy();
    });

    it("should validate analytics reports structure", async () => {
      const invalidReport = { generatedAt: "2021-01-01T00:00:00Z" }; // missing raw_data and summary
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(invalidReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        report.issues.some((i) => i.key === "analytics:reports[0]"),
      ).toBeTruthy();
    });

    it("should report missing generatedAt in analytics report", async () => {
      const invalidReport = { raw_data: {}, summary: {} };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(invalidReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(
          report,
          "analytics:reports[0]",
          "generatedAt",
        ),
      ).toBeTruthy();
    });

    it("should report missing raw_data in analytics report", async () => {
      const invalidReport = {
        generatedAt: "2021-01-01T00:00:00Z",
        summary: {},
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(invalidReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(
          report,
          "analytics:reports[0]",
          "raw_data",
        ),
      ).toBeTruthy();
    });

    it("should report missing summary in analytics report", async () => {
      const invalidReport = {
        generatedAt: "2021-01-01T00:00:00Z",
        raw_data: {},
      };
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(invalidReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(
          report,
          "analytics:reports[0]",
          "summary",
        ),
      ).toBeTruthy();
    });

    it("should handle multiple analytics reports with one invalid", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(validReport),
        JSON.stringify({ generatedAt: "invalid" }),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        report.issues.some((i) => i.key === "analytics:reports[1]"),
      ).toBeTruthy();
    });
  });

  describe("Redis Error Handling", () => {
    it("should return 500 and an error message if redis keys retrieval fails", async () => {
      sharedRedisMockKeys.mockRejectedValueOnce(new Error("Redis keys error"));

      const req = createCronRequest();
      const res = await POST(req);

      await expectErrorResponse(res, 500, "Data validation check failed");
    });

    it("should handle individual key validation errors gracefully", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis get error"));
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.issues.some((i) => i.key === "user:1")).toBeTruthy();
    });

    it("should handle null or missing Redis values", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithSubstring(report, "user:1", "null or missing"),
      ).toBeTruthy();
    });

    it("should handle invalid JSON parsing in Redis values", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sharedRedisMockGet.mockResolvedValueOnce("invalid json {]");
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(
        reportHasIssueForKeyWithRegex(
          report,
          "user:1",
          /Unexpected (token|identifier)/,
        ),
      ).toBeTruthy();
    });
  });

  describe("Report Generation", () => {
    it("should include generatedAt timestamp in report", async () => {
      setupSuccessfulRedisMocks();

      const beforeTime = new Date();
      const req = createCronRequest();
      const res = await POST(req);
      const afterTime = new Date();

      const report = await expectValidationReport(res);
      const generatedAt = new Date(report.generatedAt);

      expect(generatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(generatedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it("should save report to Redis", async () => {
      setupSuccessfulRedisMocks();

      const req = createCronRequest();
      await POST(req);

      expect(sharedRedisMockRpush).toHaveBeenCalledWith(
        "data_validation:reports",
        expect.any(String),
      );

      const savedReport = JSON.parse(
        sharedRedisMockRpush.mock.calls[0][1] as string,
      );
      expect(savedReport).toHaveProperty("summary");
      expect(savedReport).toHaveProperty("details");
      expect(savedReport).toHaveProperty("issues");
      expect(savedReport).toHaveProperty("generatedAt");
    });

    it("should include correct summary message with counts", async () => {
      sharedRedisMockKeys
        .mockResolvedValueOnce(["user:1", "user:2"])
        .mockResolvedValueOnce(["cards:1"])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["analytics:reports"]);
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("user:"))
          return Promise.resolve(JSON.stringify(validUserRecord));
        if (key.startsWith("cards:"))
          return Promise.resolve(JSON.stringify(validCardsRecord));
        return Promise.resolve(null);
      });
      sharedRedisMockLrange.mockResolvedValueOnce([
        JSON.stringify(validReport),
      ]);
      sharedRedisMockRpush.mockResolvedValue(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectValidationReport(res);

      expect(report.summary).toContain("4 keys checked");
      expect(report.summary).toContain("0 issues found");
    });
  });
});
