import { beforeEach } from "node:test";
import { afterEach } from "node:test";
import { POST } from "./route";

describe("AniList API Proxy Endpoint", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	it("should simulate 429 rate limit error in development mode", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(process.env as any).NODE_ENV = "development";
		const request = new Request("http://localhost/api/anilist", {
			method: "POST",
			headers: new Headers({
				"X-Test-Status": "429",
			}),
			// The body can be empty since the simulation happens before parsing.
			body: JSON.stringify({}),
		});

		const response = await POST(request);
		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBe("60");

		const data = await response.json();
		expect(data.error).toBe("Rate limited (test simulation)");
	});

	it("should simulate 500 internal server error in development mode", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(process.env as any).NODE_ENV = "development";
		const request = new Request("http://localhost/api/anilist", {
			method: "POST",
			headers: new Headers({
				"X-Test-Status": "500",
			}),
			body: JSON.stringify({}),
		});

		const response = await POST(request);
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data.error).toBe("Internal server error (test simulation)");
	});

	it("should forward the request and return json data when AniList API responds successfully", async () => {
		// Set non-development environment so simulations do not trigger.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(process.env as any).NODE_ENV = "production";
		process.env.ANILIST_TOKEN = "dummy-token";

		// Prepare a dummy GraphQL query and variables.
		const query = "query GetUserStats { dummyField }";
		const variables = { userId: 123 };
		const body = JSON.stringify({ query, variables });

		const request = new Request("http://localhost/api/anilist", {
			method: "POST",
			headers: new Headers({
				"Content-Type": "application/json",
			}),
			body,
		});

		// Mock the global fetch to simulate AniList API response.
		const mockData = { data: { user: "testUser" } };
		const fetchResponse = {
			ok: true,
			status: 200,
			json: jest.fn().mockResolvedValue(mockData),
			headers: new Headers(),
		};
		global.fetch = jest.fn().mockResolvedValue(fetchResponse as unknown);

		const response = await POST(request);
		expect(global.fetch).toHaveBeenCalledWith("https://graphql.anilist.co", expect.any(Object));
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data).toEqual(mockData.data);
	});

	it("should return an error when AniList API response has GraphQL errors", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(process.env as any).NODE_ENV = "production";
		process.env.ANILIST_TOKEN = "dummy-token";

		const query = "query GetUserStats { dummyField }";
		const variables = { userId: 123 };
		const body = JSON.stringify({ query, variables });

		const request = new Request("http://localhost/api/anilist", {
			method: "POST",
			headers: new Headers({
				"Content-Type": "application/json",
			}),
			body,
		});

		// Simulate a successful HTTP response with GraphQL errors.
		const fetchResponse = {
			ok: true,
			status: 200,
			json: jest.fn().mockResolvedValue({ errors: [{ message: "GraphQL error test" }] }),
			headers: new Headers(),
		};
		global.fetch = jest.fn().mockResolvedValue(fetchResponse as unknown);

		const response = await POST(request);
		// The endpoint catches the error and returns status 500.
		expect(response.status).toBe(500);

		const data = await response.json();
		expect(data.error).toBe("GraphQL error test");
	});

	it("should handle non-ok responses from AniList API correctly", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(process.env as any).NODE_ENV = "production";
		process.env.ANILIST_TOKEN = "dummy-token";

		const query = "query GetUserStats { dummyField }";
		const variables = { userId: 123 };
		const body = JSON.stringify({ query, variables });

		const request = new Request("http://localhost/api/anilist", {
			method: "POST",
			headers: new Headers({
				"Content-Type": "application/json",
			}),
			body,
		});

		// Simulate a non-ok response (for example, a rate limit from AniList).
		const fetchResponse = {
			ok: false,
			status: 429,
			json: jest.fn().mockResolvedValue({ error: "AniList API was rate limited" }),
			headers: new Headers({
				"retry-after": "60",
			}),
		};
		global.fetch = jest.fn().mockResolvedValue(fetchResponse as unknown);

		const response = await POST(request);
		expect(response.status).toBe(429);
		const data = await response.json();
		// Should combine the error message with the retry header details.
		expect(data.error).toContain("AniList API was rate limited");
		expect(data.error).toContain("Retry-After: 60");
	});
});
