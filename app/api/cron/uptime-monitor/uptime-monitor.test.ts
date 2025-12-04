import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { POST } from "./route";

/**
 * Dummy cron secret for uptime monitor test authorization.
 * @source
 */
const CRON_SECRET = "testsecret";

/**
 * Captures the original fetch implementation so it can be restored.
 * @source
 */
const originalFetch = globalThis.fetch;

/**
 * Captures the original environment variables.
 * @source
 */
const originalEnv = { ...process.env };

const applyFetchMock = (mock: unknown) => {
  globalThis.fetch = mock as typeof fetch;
};

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  mock.clearAllMocks();
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

/**
 * Helper function to delay execution
 * @param ms - Milliseconds to delay
 * @source
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe("Uptime Monitor Cron API POST Endpoint", () => {
  describe("Authorization", () => {
    it("should return 401 Unauthorized when an invalid cron secret is provided", async () => {
      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": "wrongsecret" },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toBe("Unauthorized");
    });

    it("should return 401 Unauthorized when cron secret header is missing", async () => {
      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toBe("Unauthorized");
    });

    it("should skip authorization when CRON_SECRET env var is not set", async () => {
      delete process.env.CRON_SECRET;
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("summary");
      expect(json).toHaveProperty("details");
    });
  });

  describe("Configuration", () => {
    it("should use custom NEXT_PUBLIC_SITE_URL when provided", async () => {
      const customUrl = "https://custom-domain.com";
      process.env.NEXT_PUBLIC_SITE_URL = customUrl;
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      // Verify all URLs use the custom domain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        expect(detail.url).toContain(customUrl);
      }
    });

    it("should use default fallback URL when NEXT_PUBLIC_SITE_URL is not set", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      // Verify all URLs use the default fallback domain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        expect(detail.url).toContain("https://anicards.alpha49.com");
      }
    });
  });

  describe("Successful Route Checks", () => {
    it("should report all endpoints as up when fetch succeeds for every route", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.details.length).toBe(6);
      expect(json).toHaveProperty("summary");
      expect(json).toHaveProperty("details");
      expect(json.summary).toContain("6/6 endpoints are up");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        expect(detail.ok).toBe(true);
        expect(detail.status).toBe(200);
        expect(detail.error).toBeUndefined();
      }
    });

    it("should check all 6 expected routes", async () => {
      applyFetchMock(
        mock().mockImplementation((url: string) => {
          return Promise.resolve(new Response(null, { status: 200 }));
        }),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      const expectedRoutes = [
        "/",
        "/search",
        "/contact",
        "/settings",
        "/projects",
        "/license",
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkedRoutes = (json.details as any[]).map((detail: any) => {
        const url = new URL(detail.url);
        return url.pathname;
      });

      for (const route of expectedRoutes) {
        expect(checkedRoutes).toContain(route);
      }
    });

    it("should handle responses with status codes other than 200 as ok", async () => {
      applyFetchMock(
        mock().mockImplementation((url: string) => {
          if (url.includes("/search")) {
            return Promise.resolve(new Response(null, { status: 204 }));
          }
          return Promise.resolve(new Response(null, { status: 200 }));
        }),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      // All endpoints should still be ok since fetch response.ok includes 2xx responses
      let allOk = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        if (detail.ok !== true) {
          allOk = false;
          break;
        }
      }
      expect(allOk).toBe(true);
      expect(json.summary).toContain("6/6 endpoints are up");
    });
  });

  describe("Failed Route Checks", () => {
    it("should report failures when some endpoints fail", async () => {
      applyFetchMock(
        mock().mockImplementation((url: string) => {
          if (url.includes("/contact")) {
            return Promise.resolve(new Response(null, { status: 500 }));
          }
          return Promise.resolve(new Response(null, { status: 200 }));
        }),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.details.length).toBe(6);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const successCount = (json.details as any[]).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result: any): boolean => result.ok,
      ).length;
      expect(successCount).toBe(5);
      expect(json.summary).toContain("5/6 endpoints are up");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactDetail = (json.details as any[]).find((result: any) =>
        result.url.includes("/contact"),
      );
      expect(contactDetail).toBeDefined();
      expect(contactDetail.ok).toBe(false);
      expect(contactDetail.status).toBe(500);
    });

    it("should report all endpoints as down when all fail", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 503 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.summary).toContain("0/6 endpoints are up");
    });

    it("should handle network errors gracefully", async () => {
      applyFetchMock(
        mock().mockImplementation((url: string) => {
          if (url.includes("/settings")) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve(new Response(null, { status: 200 }));
        }),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settingsDetail = (json.details as any[]).find((result: any) =>
        result.url.includes("/settings"),
      );
      expect(settingsDetail).toBeDefined();
      expect(settingsDetail.ok).toBe(false);
      expect(settingsDetail.status).toBeNull();
      expect(settingsDetail.error).toContain("Network error");
    });

    it("should capture error message when fetch fails", async () => {
      const errorMessage = "Connection timeout";
      applyFetchMock(mock().mockRejectedValue(new Error(errorMessage)));

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        expect(detail.ok).toBe(false);
        expect(detail.error).toBe(errorMessage);
      }
    });

    it("should handle timeout (AbortError) gracefully", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      applyFetchMock(mock().mockRejectedValue(abortError));

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        expect(detail.ok).toBe(false);
        expect(detail.error).toBe("Aborted");
      }
    });
  });

  describe("Response Format", () => {
    it("should return correct response headers with Content-Type application/json", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);

      expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include CORS headers in successful response", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);

      expect(res.headers.has("Access-Control-Allow-Origin")).toBe(true);
      expect(res.headers.has("Access-Control-Allow-Methods")).toBe(true);
      expect(res.headers.has("Vary")).toBe(true);
    });

    it("should include CORS headers in unauthorized response", async () => {
      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": "wrongsecret" },
      });
      const res = await POST(req);

      expect(res.headers.has("Access-Control-Allow-Origin")).toBe(true);
    });

    it("should return properly formatted result objects", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const detail of json.details as any[]) {
        expect(detail).toHaveProperty("url");
        expect(detail).toHaveProperty("ok");
        expect(detail).toHaveProperty("status");
        expect(typeof detail.url).toBe("string");
        expect(typeof detail.ok).toBe("boolean");
        expect(
          detail.status === null || typeof detail.status === "number",
        ).toBe(true);
      }
    });

    it("should include duration timing in summary", async () => {
      applyFetchMock(
        mock().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const json = await res.json();

      expect(json.summary).toMatch(/\d+ms/);
    });
  });

  describe("Concurrency", () => {
    it("should check all routes concurrently", async () => {
      const mockFetch = mock().mockResolvedValue(
        new Response(null, { status: 200 }),
      );
      applyFetchMock(mockFetch);

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      await POST(req);

      // Fetch should be called for 6 routes
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it("should complete even if some requests are slow", async () => {
      const createSlowResponse = async (url: string): Promise<Response> => {
        if (!url.includes("/contact")) {
          return new Response(null, { status: 200 });
        }
        // Simulate slow response with a delay
        await delay(100);
        return new Response(null, { status: 200 });
      };

      const mockFetch = mock().mockImplementation(createSlowResponse);
      applyFetchMock(mockFetch);

      const req = new Request("http://localhost/api/cron/uptime-monitor", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const startTime = Date.now();
      const res = await POST(req);
      const endTime = Date.now();

      // Request should complete relatively quickly (concurrency)
      // If sequential, it would take much longer
      expect(res.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});
