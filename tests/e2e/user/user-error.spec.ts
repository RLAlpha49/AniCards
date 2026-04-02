import {
  dismissAnalyticsPromptIfVisible,
  waitForAppReady,
} from "../fixtures/browser-utils";
import { expect, test } from "../fixtures/test-utils";

async function gotoMockedUserErrorPage(
  page: Parameters<typeof waitForAppReady>[0],
  url: string,
): Promise<void> {
  await page.goto(url, { waitUntil: "commit" });
  await waitForAppReady(page);
  await dismissAnalyticsPromptIfVisible(page);
}

test.describe("User page error states", () => {
  test("publishes install metadata for the mobile shell", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const manifestResponse = await request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
      short_name: "AniCards",
      display: "standalone",
      start_url: "/",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/pwa/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/pwa/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        }),
        expect.objectContaining({ src: "/pwa/icon-any.svg" }),
        expect.objectContaining({
          src: "/pwa/icon-maskable-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: expect.stringContaining("maskable"),
        }),
        expect.objectContaining({
          src: "/pwa/icon-maskable-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: expect.stringContaining("maskable"),
        }),
        expect.objectContaining({
          src: "/pwa/icon-maskable.svg",
          purpose: expect.stringContaining("maskable"),
        }),
        expect.objectContaining({
          src: "/pwa/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        }),
      ]),
    );
  });
});

test.describe("User page error states (mocked API)", () => {
  test.use({ serviceWorkers: "block" });

  test("shows rate limit error with recovery link", async ({
    page,
    mockRateLimitedApi,
  }) => {
    void mockRateLimitedApi;

    await gotoMockedUserErrorPage(page, "/user/RateLimitedUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByText(/rate limit exceeded|too many requests/i),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });

  test("shows network failure guidance when requests fail", async ({
    page,
    mockNetworkError,
  }) => {
    void mockNetworkError;

    await gotoMockedUserErrorPage(page, "/user/OfflineUser");

    await expect(
      page.getByText(
        /failed to fetch user data|network connection error|check your connection/i,
      ),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });
});

test.describe("User page error states (offline shell)", () => {
  test("serves the offline shell during real offline navigations", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["chromium", "mobile-chrome"].includes(testInfo.project.name),
      "Offline service-worker fallback is only exercised reliably in Chromium-based Playwright projects.",
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(() => "serviceWorker" in navigator);

    await page.reload();
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );

    await page.context().setOffline(true);

    await page.goto("/user/OfflineUser", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", { name: /you.?re offline/i }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /cached public pages and the install shell are still here/i,
      ),
    ).toBeVisible();

    const homeLink = page.getByRole("link", { name: /back home/i });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");

    await page.context().setOffline(false);
  });
});
