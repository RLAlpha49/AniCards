import { expect, test } from "../fixtures/test-utils";

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
        expect.objectContaining({ src: "/pwa/icon-any.svg" }),
        expect.objectContaining({
          src: "/pwa/icon-maskable.svg",
          purpose: expect.stringContaining("maskable"),
        }),
      ]),
    );
  });

  test("shows rate limit error with recovery link", async ({
    page,
    mockRateLimitedApi,
  }) => {
    void mockRateLimitedApi;

    await page.goto("/user/RateLimitedUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/rate limit exceeded|too many requests/i),
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

    await page.goto("/user/OfflineUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible();

    await expect(
      page.getByText(
        /failed to fetch user data|network connection error|check your connection/i,
      ),
    ).toBeVisible();

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });

  test("serves the offline shell during real offline navigations", async ({
    page,
  }) => {
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
