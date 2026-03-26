import { expect, test } from "@playwright/test";

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

test.describe("Unmocked app shell smoke", () => {
  test("serves the home app shell with middleware CSP headers and nonce-aware JSON-LD", async ({
    page,
    request,
  }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    const cspHeader = headers["content-security-policy"];
    const html = await response.text();
    const nonceMatch = html.match(/nonce="([^"]+)"/);

    expect(cspHeader).toBeTruthy();
    expect(nonceMatch).toBeTruthy();

    const nonce = nonceMatch?.[1];
    if (!nonce || !cspHeader) {
      throw new Error("Expected nonce-bearing HTML and a CSP header");
    }

    expect(cspHeader).toContain(`'nonce-${nonce}'`);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain(`nonce="${nonce}"`);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page).toHaveTitle(/AniCards/i);
  });

  test("serves robots.txt from the real metadata route", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);

    const robotsText = await response.text();
    const origin = new URL(response.url()).origin;
    const sitemapUrl = `${origin}/sitemap.xml`;

    expect(robotsText).toMatch(/user-agent:\s*\*/i);
    expect(robotsText).toMatch(/disallow:\s*\/api\//i);
    expect(robotsText).toMatch(
      new RegExp(String.raw`host:\s*${escapeRegExp(origin)}`, "i"),
    );
    expect(robotsText).toMatch(
      new RegExp(String.raw`sitemap:\s*${escapeRegExp(sitemapUrl)}`, "i"),
    );
  });

  test("redirects legacy lookup URLs to the canonical profile route with lookup-safe metadata", async ({
    page,
  }) => {
    await page.goto("/user?username=Alpha49&q=seasonal", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(/\/user\/Alpha49\?q=seasonal$/);
    await expect(page).toHaveTitle(/Alpha49's AniList Stats - AniCards/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/user\/Alpha49$/,
    );
  });
});
