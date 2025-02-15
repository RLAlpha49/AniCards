import { POST } from "./route";
import { NextRequest } from "next/server";
import sharp from "sharp";

jest.mock("@upstash/redis", () => ({
	Redis: {
		fromEnv: jest.fn(() => ({
			incr: jest.fn(() => Promise.resolve(1)),
		})),
	},
}));

// Mocking "sharp" so we can simulate the PNG conversion.
jest.mock("sharp", () => {
	// Return a function that returns an object with a png() method.
	return jest.fn(() => ({
		png: () => ({
			toBuffer: async () => Buffer.from("FAKEPNG"),
		}),
	}));
});

describe("Convert API POST Endpoint", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		jest.clearAllMocks();
		global.fetch = originalFetch;
	});

	it("should return 400 error if svgUrl parameter is missing", async () => {
		// Create a request without the required "svgUrl"
		const req = new Request("http://localhost/api/convert", {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
			body: JSON.stringify({}),
		}) as unknown as NextRequest;

		const res = await POST(req);
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe("Missing svgUrl parameter");
	});

	it("should return error if fetching SVG fails", async () => {
		// Provide a valid request body.
		const req = new Request("http://localhost/api/convert", {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
			body: JSON.stringify({ svgUrl: "http://example.com/fake.svg" }),
		}) as unknown as NextRequest;

		// Mock fetch to simulate a failed response.
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 404,
			text: async () => "Not Found",
		});

		const res = await POST(req);
		// The endpoint should forward the status returned by fetch.
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.error).toBe("Failed to fetch SVG");
	});

	it("should successfully convert SVG to PNG", async () => {
		const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
		// Provide a valid request with svgUrl.
		const req = new Request("http://localhost/api/convert", {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
			body: JSON.stringify({ svgUrl: "http://example.com/dummy.svg" }),
		}) as unknown as NextRequest;

		// Mock fetch to return the dummy SVG content.
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => dummySVG,
		});

		const res = await POST(req);
		expect(res.status).toBe(200);
		const data = await res.json();
		// The pngDataUrl should start with the proper data URL prefix.
		expect(data.pngDataUrl).toContain("data:image/png;base64,");
		// Verify that our mocked sharp converted the SVG to PNG.
		const expectedBase64 = Buffer.from("FAKEPNG").toString("base64");
		expect(data.pngDataUrl).toBe(`data:image/png;base64,${expectedBase64}`);
	});

	it("should return 500 error when sharp conversion fails", async () => {
		const dummySVG = `<svg><circle cx="50" cy="50" r="40"/></svg>`;
		const req = new Request("http://localhost/api/convert", {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
			body: JSON.stringify({ svgUrl: "http://example.com/dummy.svg" }),
		}) as unknown as NextRequest;

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => dummySVG,
		});

		// Override the sharp mock for this test to simulate an error.
		(sharp as unknown as jest.Mock).mockImplementationOnce(() => ({
			png: () => ({
				toBuffer: async () => {
					throw new Error("Sharp failure");
				},
			}),
		}));

		const res = await POST(req);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error).toBe("Conversion failed");
	});
});
