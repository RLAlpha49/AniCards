import { type APIRequestContext, expect, test } from "@playwright/test";

import { getSiteUrl } from "@/lib/site-config";

import {
  dismissAnalyticsPromptIfVisible,
  gotoReady,
} from "../fixtures/browser-utils";

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

async function getWithRetry(
  request: APIRequestContext,
  url: string,
  timeout = 30000,
): Promise<Awaited<ReturnType<APIRequestContext["get"]>>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await request.get(url, { timeout });
    } catch (error) {
      lastError = error;

      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${url}`);
}

test.describe("Unmocked app shell smoke", () => {
  const mobileNavigationViewport = {
    width: 393,
    height: 851,
  };

  test("serves the home app shell with middleware CSP headers, nonce-aware JSON-LD, and the legacy card rewrite surface", async ({
    page,
    request,
  }) => {
    const response = await getWithRetry(request, "/");
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

    const legacyCardResponse = await getWithRetry(request, "/card.svg");
    expect(legacyCardResponse.status()).toBe(400);

    const legacyCardHeaders = legacyCardResponse.headers();
    const legacyCardSvg = await legacyCardResponse.text();

    expect(legacyCardHeaders["content-type"]).toContain("image/svg+xml");
    expect(legacyCardHeaders["cache-control"]).toContain("no-store");
    expect(legacyCardHeaders["x-card-border-radius"]).toBeTruthy();
    expect(legacyCardHeaders["access-control-expose-headers"]).toMatch(
      /x-card-border-radius/i,
    );
    expect(legacyCardSvg).toContain(
      "Client Error: Missing parameter: cardType",
    );
  });

  test("exposes a root-shell skip link, stable main target, and AniList preconnect hint", async ({
    page,
  }) => {
    await gotoReady(page, "/");
    await dismissAnalyticsPromptIfVisible(page);

    const skipLink = page.locator("a.skip-link");
    const mainContent = page.locator("#main-content");
    const anilistPreconnect = page.locator(
      'link[rel="preconnect"][href="https://anilist.co"]',
    );

    await expect(anilistPreconnect).toHaveCount(1);
    await expect(skipLink).toHaveAttribute("href", "#main-content");

    await skipLink.focus();
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(mainContent).toBeFocused();
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("traps focus in the mobile navigation menu and restores focus on close", async ({
    page,
  }) => {
    await page.setViewportSize(mobileNavigationViewport);
    await gotoReady(page, "/");

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

  test("keeps the home hero and mobile navigation reachable when JavaScript is unavailable", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: mobileNavigationViewport,
    });
    const page = await context.newPage();

    try {
      await page.goto(new URL("/", getSiteUrl()).toString(), {
        waitUntil: "load",
      });

      await expect(
        page.getByRole("link", { name: /^get started$/i }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator('[data-mobile-navigation-fallback="true"]'),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page
          .locator('[data-mobile-navigation-fallback="true"]')
          .getByRole("link", {
            name: /^search$/i,
          }),
      ).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-mobile-menu-toggle="true"]')).toBeHidden(
        {
          timeout: 15000,
        },
      );
    } finally {
      await context.close();
    }
  });

  test("serves robots.txt from the real metadata route", async ({
    request,
  }) => {
    const response = await getWithRetry(request, "/robots.txt");
    expect(response.ok()).toBe(true);

    const robotsText = await response.text();
    const origin = getSiteUrl();
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

  test("resolves legacy lookup URLs with lookup-safe metadata", async ({
    page,
  }) => {
    await page.goto("/user?username=Alpha49&q=seasonal", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(
      /\/user(?:\/Alpha49\?q=seasonal|\?username=Alpha49&q=seasonal)$/,
      {
        timeout: 15000,
      },
    );

    await expect(page).toHaveURL(
      /\/user(?:\/Alpha49\?q=seasonal|\?username=Alpha49&q=seasonal)$/,
      { timeout: 15000 },
    );
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
