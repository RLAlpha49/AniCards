/* eslint-disable no-var */
import { GET } from "./route";

// Declare mockRedisGet in the outer scope so tests can control its behavior.
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

// A helper function to extract JSON from the response.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getResponseJson(response: Response): Promise<any> {
	return response.json();
}

describe("Cards API GET Endpoint", () => {
	const baseUrl = "http://localhost/api/cards";

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should return 400 error for missing userId parameter", async () => {
		const req = new Request(`${baseUrl}`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(400);
		const json = await getResponseJson(res);
		expect(json.error).toBe("Missing user ID parameter");
	});

	it("should return 400 error for invalid user ID format", async () => {
		const req = new Request(`${baseUrl}?userId=abc`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(400);
		const json = await getResponseJson(res);
		expect(json.error).toBe("Invalid user ID format");
	});

	it("should return 404 if cards are not found in Redis", async () => {
		// Simulate missing data in Redis.
		mockRedisGet.mockResolvedValueOnce(null);
		const req = new Request(`${baseUrl}?userId=123`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(404);
		const json = await getResponseJson(res);
		expect(json.error).toBe("Cards not found");
	});

	it("should successfully return card data when present", async () => {
		const cardData = { cards: [{ cardName: "animeStats", titleColor: "#000" }] };
		// Simulate valid card data stored in Redis.
		mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
		const req = new Request(`${baseUrl}?userId=456`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const json = await getResponseJson(res);
		expect(json).toEqual(cardData);
	});

	it("should return 500 if an error occurs during card data retrieval", async () => {
		// Simulate a Redis error.
		mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));
		const req = new Request(`${baseUrl}?userId=123`, {
			headers: { "x-forwarded-for": "127.0.0.1" },
		});
		const res = await GET(req);
		expect(res.status).toBe(500);
		const json = await getResponseJson(res);
		expect(json.error).toBe("Failed to fetch cards");
	});
});
