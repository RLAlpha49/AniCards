import { describe, expect, it } from "bun:test";
import { GET } from "../../../../../../app/StatCards/[username]/[key].svg/route";

describe("StatCards SVG notice route", () => {
  it("returns static notice SVG with cache control disabled", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    const body = await response.text();
    expect(body).toContain("AniCards Updated!");
    expect(body).toContain("anicards.alpha49.com");
    expect(body.trim().startsWith("<svg")).toBe(true);
  });
});
