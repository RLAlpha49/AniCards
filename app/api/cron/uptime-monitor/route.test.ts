import { POST } from "./route";

// Set a dummy CRON_SECRET for testing.
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

// Save the original fetch.
const originalFetch = global.fetch;

afterEach(() => {
  jest.clearAllMocks();
  global.fetch = originalFetch;
});

describe("Uptime Monitor Cron API POST Endpoint", () => {
  it("should return 401 Unauthorized when an invalid cron secret is provided", async () => {
    const req = new Request("http://localhost/api/cron/uptime-monitor", {
      headers: { "x-cron-secret": "wrongsecret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Unauthorized");
  });

  it("should report all endpoints as up when fetch succeeds for every route", async () => {
    // Simulate fetch such that every request returns a successful response.
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const req = new Request("http://localhost/api/cron/uptime-monitor", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.details.length).toBe(6);

    // Expect a summary string and a details array.
    expect(json).toHaveProperty("summary");
    expect(json).toHaveProperty("details");

    // Since all fetch calls return status 200, all endpoints are up.
    expect(json.summary).toContain("6/6 endpoints are up");
  });

  it("should report failures when some endpoints fail", async () => {
    // Simulate fetch such that the "/contact" route returns a failure.
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/contact")) {
        // Return a response with status 500 (not ok).
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      // Otherwise, simulate success with status 200.
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    const req = new Request("http://localhost/api/cron/uptime-monitor", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // Expect details array with 6 entries.
    expect(json.details.length).toBe(6);

    // Determine success count manually.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const successCount = json.details.filter((result: any) => result.ok).length;
    // Since one route ("/contact") fails, 5 endpoints should be up out of 6.
    expect(successCount).toBe(5);
    expect(json.summary).toContain("5/6 endpoints are up");

    // Verify that among the details, the route corresponding to "/contact" has ok === false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactDetail = json.details.find((result: any) =>
      result.url.includes("/contact"),
    );
    expect(contactDetail).toBeDefined();
    expect(contactDetail.ok).toBe(false);
    expect(contactDetail.status).toBe(500);
  });
});
