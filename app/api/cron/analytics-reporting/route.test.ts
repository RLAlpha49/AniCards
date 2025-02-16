import { POST } from "./route";

// Set up mocks for @upstash/redis.
const mockKeys = jest.fn();
const mockGet = jest.fn();
const mockRpush = jest.fn();
const fakeRedisClient = {
	keys: mockKeys,
	get: mockGet,
	rpush: mockRpush,
};

jest.mock("@upstash/redis", () => ({
	Redis: {
		fromEnv: jest.fn(() => fakeRedisClient),
	},
}));

// Set a dummy CRON_SECRET for testing.
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

describe("Analytics & Reporting Cron API POST Endpoint", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should return 401 Unauthorized when cron secret is missing or invalid", async () => {
		const req = new Request("http://localhost/api/cron/analytics-reporting", {
			headers: { "x-cron-secret": "wrongsecret" },
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
		const text = await res.text();
		expect(text).toBe("Unauthorized");
	});

	it("should generate analytics report successfully", async () => {
		// Simulate Redis returning two analytics keys.
		mockKeys.mockResolvedValueOnce([
			"analytics:visits",
			"analytics:anilist_api:successful_requests",
		]);

		// Simulate Redis get responses for each key.
		mockGet.mockImplementation((key: string) => {
			if (key === "analytics:visits") {
				return Promise.resolve("100");
			} else if (key === "analytics:anilist_api:successful_requests") {
				return Promise.resolve("200");
			}
			return Promise.resolve(null);
		});

		// Simulate rpush success.
		mockRpush.mockResolvedValueOnce(1);

		const req = new Request("http://localhost/api/cron/analytics-reporting", {
			headers: { "x-cron-secret": CRON_SECRET },
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		const report = await res.json();

		// Report should contain summary, raw_data, and generatedAt.
		expect(report).toHaveProperty("summary");
		expect(report).toHaveProperty("raw_data");
		expect(report).toHaveProperty("generatedAt");

		// Verify the summary.
		// "analytics:visits" is split into ["analytics", "visits"] so summary.visits should be 100.
		expect(report.summary.visits).toBe(100);
		// "analytics:anilist_api:successful_requests" splits into ["analytics", "anilist_api", "successful_requests"].
		expect(report.summary.anilist_api).toEqual({ successful_requests: 200 });

		// raw_data should contain the raw numbers.
		expect(report.raw_data).toEqual({
			"analytics:visits": 100,
			"analytics:anilist_api:successful_requests": 200,
		});

		// Verify that rpush was called with the "analytics:reports" key.
		expect(mockRpush).toHaveBeenCalledWith("analytics:reports", expect.any(String));
	});

	it("should return 500 and an error message if redis keys retrieval fails", async () => {
		// Simulate failure when fetching keys.
		mockKeys.mockRejectedValueOnce(new Error("Redis error"));
		const req = new Request("http://localhost/api/cron/analytics-reporting", {
			headers: { "x-cron-secret": CRON_SECRET },
		});
		const res = await POST(req);
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(text).toBe("Analytics and reporting job failed");
	});
});
