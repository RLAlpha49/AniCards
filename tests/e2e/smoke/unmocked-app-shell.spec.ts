import { expect, type Page, test } from "@playwright/test";

async function dismissAnalyticsPromptIfVisible(page: Page) {
  const dismissButton = page.getByRole("button", {
    name: /keep it off/i,
  });

  if (await dismissButton.isVisible()) {
    await dismissButton.click();
  }
}

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

  test("exposes a root-shell skip link, stable main target, and AniList preconnect hint", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsPromptIfVisible(page);

    const skipLink = page.locator("a.skip-link");
    const mainContent = page.locator("#main-content");
    const anilistPreconnect = page.locator(
      'link[rel="preconnect"][href="https://anilist.co"]',
    );

    await expect(anilistPreconnect).toHaveCount(1);

    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(mainContent).toBeFocused();
  });

  test("traps focus in the mobile navigation menu and restores focus on close", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "This spec validates mobile-menu focus behavior.",
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsPromptIfVisible(page);

    const menuToggle = page.getByRole("button", { name: /open menu/i });
    await menuToggle.click();

    const mobileNavigation = page.locator("#mobile-navigation");
    const firstLink = mobileNavigation.getByRole("link", { name: /^home$/i });
    const lastLink = mobileNavigation.getByRole("link", {
      name: /^contact$/i,
    });

    await expect(mobileNavigation).toBeVisible();
    await expect(firstLink).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(lastLink).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(firstLink).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(mobileNavigation).toBeHidden();
    await expect(menuToggle).toBeFocused();
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
    await page.waitForURL(/\/user\/Alpha49\?q=seasonal$/, {
      waitUntil: "load",
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
