/* eslint-disable no-var */
/**
 * This test file covers the GET handler for the card SVG endpoint.
 * It mocks external dependencies such as the rate limiter, Redis, and external utility/template functions.
 */

// Declare mockLimit in the outer scope so tests can access it.
var mockLimit = jest.fn().mockResolvedValue({ success: true });
var mockRedisGet = jest.fn();

jest.mock("@upstash/redis", () => {
	return {
		Redis: {
			fromEnv: jest.fn(() => ({
				get: mockRedisGet,
			})),
		},
	};
});

import { GET } from "./route";

// --- Mocks for external dependencies --- //
jest.mock("@upstash/ratelimit", () => {
	const RatelimitMock = jest.fn().mockImplementation(() => ({
		limit: mockLimit,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any;
	RatelimitMock.slidingWindow = jest.fn();
	return {
		Ratelimit: RatelimitMock,
	};
});

jest.mock("@/lib/utils/milestones", () => ({
	calculateMilestones: jest.fn(() => ({ milestone: 100 })),
}));

jest.mock("@/lib/svg-templates/media-stats", () => ({
	mediaStatsTemplate: jest.fn(() => "<svg>Anime Stats</svg>"),
}));

jest.mock("@/lib/utils", () => ({
	safeParse: (str: string) => JSON.parse(str),
	// Keep calculateMilestones from the dedicated module above.
}));

// A helper function to extract text content from a Response.
async function getResponseText(response: Response): Promise<string> {
	return response.text();
}

describe("Card SVG GET Endpoint", () => {
	const baseUrl = "http://localhost/api/card.svg";

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should return rate limit error when limit exceeded", async () => {
		// Simulate rate limiter failure.
		mockLimit.mockResolvedValueOnce({ success: false });
		mockRedisGet.mockClear();

		const req = new Request(`${baseUrl}?userId=123&cardType=animeStats`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});

		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Too many requests - try again later");
	});

	it("should return error for missing parameters", async () => {
		// Missing cardType.
		const req = new Request(`${baseUrl}?userId=123`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});

		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Missing parameters");
	});

	it("should return error for invalid card type", async () => {
		// Provide a cardType that is not allowed.
		const req = new Request(`${baseUrl}?userId=123&cardType=invalidType`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});

		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Invalid card type");
	});

	it("should return error for invalid user ID format", async () => {
		// userId that cannot be parsed as a number.
		const req = new Request(`${baseUrl}?userId=abc&cardType=animeStats`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Invalid user ID");
	});

	it("should return error if user data is not found in Redis", async () => {
		// Simulate Redis missing one of the keys.
		mockRedisGet.mockResolvedValueOnce(null).mockResolvedValueOnce(
			JSON.stringify({
				userId: 123,
				username: "testUser",
				stats: { User: { statistics: { anime: { episodesWatched: 100 } } } },
			})
		);
		const req = new Request(`${baseUrl}?userId=123&cardType=animeStats`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("User data not found");
	});

	it("should return error when card config is not found", async () => {
		// Return valid user record.
		const userData = JSON.stringify({
			userId: 123,
			username: "testUser",
			stats: { User: { statistics: { anime: { episodesWatched: 100 } } } },
		});
		// Return a cards record that does not include the requested card config.
		const cardsData = JSON.stringify({
			cards: [
				{
					cardName: "otherCard",
					titleColor: "#000",
					backgroundColor: "#fff",
					textColor: "#333",
					circleColor: "#f00",
				},
			],
		});
		mockRedisGet.mockResolvedValueOnce(cardsData).mockResolvedValueOnce(userData);

		const req = new Request(`${baseUrl}?userId=123&cardType=animeStats`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Card config not found");
	});

	it("should successfully generate SVG content", async () => {
		// Valid cards record with matching card config.
		const cardsData = JSON.stringify({
			cards: [
				{
					cardName: "animeStats",
					variation: "default",
					titleColor: "#3cc8ff",
					backgroundColor: "#0b1622",
					textColor: "#E8E8E8",
					circleColor: "#3cc8ff",
				},
			],
		});
		// Valid user record with proper stats.
		const userData = JSON.stringify({
			userId: 542244,
			username: "testUser",
			stats: {
				User: {
					statistics: {
						anime: {
							count: 426,
							episodesWatched: 5474,
							minutesWatched: 129587,
							meanScore: 71.67,
							standardDeviation: 12,
						},
					},
				},
			},
		});
		mockRedisGet.mockResolvedValueOnce(cardsData).mockResolvedValueOnce(userData);

		const req = new Request(`${baseUrl}?userId=542244&cardType=animeStats&variation=default`);
		console.log("req", req);
		const res = await GET(req);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
		const text = await getResponseText(res);
		expect(text).toBe("<svg>Anime Stats</svg>");
	});

	it("should return server error when SVG generation fails (inner try)", async () => {
		// Provide a valid cards record.
		const cardsData = JSON.stringify({
			cards: [
				{
					cardName: "animeStats",
					titleColor: "#000",
					backgroundColor: "#fff",
					textColor: "#333",
					circleColor: "#f00",
				},
			],
		});
		// Provide a user record missing the required stats (will cause generateCardSVG to throw).
		const userData = JSON.stringify({
			userId: 123,
			username: "testUser",
			stats: {}, // missing User.statistics.anime
		});
		mockRedisGet.mockResolvedValueOnce(cardsData).mockResolvedValueOnce(userData);

		const req = new Request(`${baseUrl}?userId=123&cardType=animeStats`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Server Error");
	});

	it("should return server error when an outer error occurs", async () => {
		// Simulate Redis throwing an error.
		mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));
		const req = new Request(`${baseUrl}?userId=123&cardType=animeStats`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const text = await getResponseText(res);
		expect(text).toContain("Server Error");
	});
});
