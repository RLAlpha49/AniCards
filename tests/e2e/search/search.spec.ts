import { expect, type Locator, type Page, test } from "@playwright/test";

import { gotoReady, waitForUiReady } from "../fixtures/browser-utils";

const LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY =
  "anicards:last-successful-user-page-route:v1";
const PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY =
  "anicards:user-page-settings-template-apply:v1";

async function waitForSearchFormReady(page: Page): Promise<void> {
  await waitForUiReady(page.getByTestId("search-form"));
  await expect(page.getByRole("button", { name: /find profile/i })).toBeEnabled(
    {
      timeout: 15000,
    },
  );
  await expect(page.getByRole("radio", { name: /^username$/i })).toBeChecked({
    timeout: 15000,
  });
}

async function selectLookupMethod(
  page: Page,
  label: "Username" | "User ID",
): Promise<void> {
  const radio = page.getByRole("radio", {
    name: new RegExp(`^${label}$`, "i"),
  });
  const option = page
    .locator("label")
    .filter({ hasText: new RegExp(String.raw`^\s*${label}\s*$`, "i") })
    .first();

  await option.click();

  await expect(radio).toBeChecked();
}

async function setSearchValue(input: Locator, value: string): Promise<void> {
  await expect(input).toBeVisible({ timeout: 15000 });
  await expect(input).toBeEnabled({ timeout: 15000 });
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

async function submitSearchForm(page: Page): Promise<void> {
  const submitButton = page.getByRole("button", { name: /find profile/i });
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await submitButton.click();
}

function getVisibleNoJsSearchInput(page: Page): Locator {
  return page.locator("input[name='query']:visible").first();
}

function getVisibleNoJsSearchSubmitButton(page: Page): Locator {
  return page
    .locator("button:visible")
    .filter({ hasText: /find profile/i })
    .first();
}

function getVisibleNoJsLookupResult(page: Page): Locator {
  return page.locator("[data-testid='search-lookup-result']:visible").first();
}

function getVisibleNoJsLookupCta(page: Page): Locator {
  return page.locator("[data-testid='search-lookup-cta']:visible").first();
}

async function mockBootstrapLookup(
  page: Page,
  options: {
    mode: "username" | "userId";
    query: string;
    resolvedUserId: number;
    resolvedUsername: string;
  },
): Promise<void> {
  await page.route("**/api/get-user?**", async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.searchParams.get("view") !== "bootstrap") {
      await route.continue();
      return;
    }

    const actualQuery =
      options.mode === "userId"
        ? requestUrl.searchParams.get("userId")
        : requestUrl.searchParams.get("username");

    if (actualQuery !== options.query) {
      await route.fulfill({
        body: JSON.stringify({ error: "User not found" }),
        contentType: "application/json",
        status: 404,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        avatarUrl: "https://example.com/avatar.png",
        userId: options.resolvedUserId,
        username: options.resolvedUsername,
      }),
      contentType: "application/json",
      status: 200,
    });
  });
}

test.describe("Search page", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/search");
    await waitForSearchFormReady(page);
  });

  test("switches between username and user ID modes", async ({ page }) => {
    const usernameToggle = page.getByRole("radio", { name: /^username$/i });
    const userIdToggle = page.getByRole("radio", { name: /user id/i });

    const usernameInput = page.getByLabel(/AniList Username/i);
    await expect(usernameToggle).toBeChecked();
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute("type", "search");
    await expect(usernameInput).toHaveAttribute("inputmode", "search");
    await expect(usernameInput).toHaveAttribute("autocomplete", "off");
    await expect(usernameInput).toHaveAttribute("autocapitalize", "none");
    await expect(usernameInput).toHaveAttribute("autocorrect", "off");
    await expect(usernameInput).toHaveAttribute("placeholder", /Alpha49/i);

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await selectLookupMethod(page, "User ID");
    await expect(userIdToggle).toBeChecked();
    await expect(userIdInput).toBeVisible();
    await expect(userIdInput).toHaveAttribute("type", "text");
    await expect(userIdInput).toHaveAttribute("inputmode", "numeric");
    await expect(userIdInput).toHaveAttribute("autocomplete", "off");
    await expect(userIdInput).toHaveAttribute("placeholder", /542244/i);
    await expect(page.getByLabel(/AniList Username/i)).toHaveCount(0);

    await selectLookupMethod(page, "Username");
    await expect(usernameToggle).toBeChecked();
    await expect(usernameInput).toBeVisible();
  });

  test("shows validation errors for empty submissions", async ({ page }) => {
    const usernameInput = page.getByLabel(/AniList Username/i);
    const validationAlert = page.locator('[role="alert"]');

    await submitSearchForm(page);
    const usernameAlert = validationAlert.filter({
      hasText:
        /you'll need to enter an anilist username, profile link, or user id first/i,
    });
    await expect(usernameAlert).toBeVisible({ timeout: 15000 });
    await expect(usernameInput).toBeFocused();
    await expect(usernameInput).toHaveAttribute("aria-invalid", "true");
    await expect(usernameInput).toHaveAttribute(
      "aria-describedby",
      /search-hint/,
    );
    await expect(usernameInput).toHaveAttribute(
      "aria-describedby",
      /search-error/,
    );
    await expect(page).toHaveURL(/\/search$/);

    await selectLookupMethod(page, "User ID");

    await submitSearchForm(page);
    const userIdAlert = validationAlert.filter({
      hasText: /you'll need to enter a numeric anilist user id first/i,
    });
    await expect(userIdAlert).toBeVisible({ timeout: 15000 });

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await expect(userIdInput).toBeFocused();
    await expect(userIdInput).toHaveAttribute("aria-invalid", "true");
    await setSearchValue(userIdInput, "542244");
    await expect(
      page.getByText(/you'll need to enter a numeric anilist user id first/i),
    ).toHaveCount(0);
  });

  test("normalizes AniList profile URLs in username mode before navigating", async ({
    page,
  }) => {
    await mockBootstrapLookup(page, {
      mode: "username",
      query: "Alpha49",
      resolvedUserId: 542244,
      resolvedUsername: "Alpha49",
    });

    const input = page.getByLabel(/AniList Username/i);
    await setSearchValue(input, "https://anilist.co/user/Alpha49/animelist");

    await submitSearchForm(page);
    await expect(page).toHaveURL(/\/search\?query=Alpha49/i, {
      timeout: 15000,
    });
    await expect(page.getByTestId("search-lookup-result")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("search-lookup-cta")).toHaveAttribute(
      "href",
      "/user/Alpha49",
    );

    await page.getByTestId("search-lookup-cta").click();
    await expect(page).toHaveURL(/\/user\/Alpha49/i, { timeout: 15000 });
  });

  test("navigates to user page when searching by user ID", async ({ page }) => {
    await mockBootstrapLookup(page, {
      mode: "userId",
      query: "123456",
      resolvedUserId: 123456,
      resolvedUsername: "TestUser",
    });

    await selectLookupMethod(page, "User ID");

    const input = page.getByLabel(/AniList User ID/i);
    await setSearchValue(input, "123456");

    await submitSearchForm(page);
    await expect(page).toHaveURL(/\/search\?mode=userId&query=123456/i, {
      timeout: 15000,
    });
    await expect(page.getByTestId("search-lookup-cta")).toHaveAttribute(
      "href",
      "/user/TestUser",
    );

    await page.getByTestId("search-lookup-cta").click();
    await expect(page).toHaveURL(/\/user\/TestUser/i, { timeout: 15000 });
  });

  test("shows queued style context on search, keeps resume continuity, and lets the user clear it", async ({
    page,
  }) => {
    await page.evaluate(
      ({ lastRouteKey, pendingKey }) => {
        globalThis.sessionStorage.setItem(
          pendingKey,
          JSON.stringify({
            templateId: "example:anime-stats:minimal:light",
            templateName: "Anime Stats — Minimal (Light)",
            applyTo: "global",
            source: "examples",
            queuedAt: Date.now(),
          }),
        );
        globalThis.sessionStorage.setItem(
          lastRouteKey,
          JSON.stringify({
            href: "/user/Alpha49",
            userId: "542244",
            username: "Alpha49",
            savedAt: Date.now(),
          }),
        );
      },
      {
        lastRouteKey: LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
        pendingKey: PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      },
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSearchFormReady(page);

    const pendingTemplateBanner = page.getByTestId("search-pending-template");

    await expect(pendingTemplateBanner).toBeVisible({
      timeout: 15000,
    });
    await expect(pendingTemplateBanner).toContainText(/queued style ready/i);
    await expect(pendingTemplateBanner).toContainText(
      /anime stats — minimal \(light\)/i,
    );
    await expect(
      page
        .getByTestId("search-last-editor-card")
        .getByRole("button", { name: /resume last editor/i }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /clear queued style/i }).click();

    await expect(pendingTemplateBanner).toHaveCount(0);
    await expect(
      page
        .getByTestId("search-last-editor-card")
        .getByRole("button", { name: /resume last editor/i }),
    ).toBeVisible({ timeout: 15000 });
    expect(
      await page.evaluate(
        (pendingKey) => globalThis.sessionStorage.getItem(pendingKey),
        PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      ),
    ).toBeNull();
  });

  test("shows last editor continuity even when no queued style is present", async ({
    page,
  }) => {
    await page.evaluate((lastRouteKey) => {
      globalThis.sessionStorage.setItem(
        lastRouteKey,
        JSON.stringify({
          href: "/user/Alpha49",
          userId: "542244",
          username: "Alpha49",
          savedAt: Date.now(),
        }),
      );
    }, LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSearchFormReady(page);

    await expect(page.getByTestId("search-pending-template")).toHaveCount(0);
    await expect(
      page
        .getByTestId("search-last-editor-card")
        .getByRole("button", { name: /resume last editor/i }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("search-last-editor-card")).toContainText(
      /@Alpha49/i,
    );
  });

  test("queues a starter look from the launch section and surfaces it in the hero", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /queue anicards dark/i }).click();

    const pendingTemplateBanner = page.getByTestId("search-pending-template");
    await expect(pendingTemplateBanner).toBeVisible({ timeout: 15000 });
    await expect(pendingTemplateBanner).toContainText(/queued style ready/i);
    await expect(pendingTemplateBanner).toContainText(/anicards dark/i);
    await expect(page).toHaveURL(/\/search$/i, { timeout: 15000 });

    const pendingTemplate = await page.evaluate((pendingKey) => {
      const raw = globalThis.sessionStorage.getItem(pendingKey);
      return raw ? JSON.parse(raw) : null;
    }, PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY);

    expect(pendingTemplate).toMatchObject({
      applyTo: "global",
      source: "examples",
      templateId: "starter:anicards-dark",
      templateName: "AniCards Dark",
    });
  });

  test("submits as a real GET search flow without JavaScript", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    const baseUrl =
      typeof testInfo.project.use.baseURL === "string"
        ? testInfo.project.use.baseURL
        : "http://localhost:3000";

    try {
      await page.goto(new URL("/search", baseUrl).toString(), {
        waitUntil: "load",
      });

      const usernameInput = getVisibleNoJsSearchInput(page);
      await usernameInput.fill("Alpha49");
      await getVisibleNoJsSearchSubmitButton(page).click();

      await expect(page).toHaveURL(/\/search\?query=Alpha49/i, {
        timeout: 15000,
      });
      await expect(getVisibleNoJsLookupResult(page)).toBeVisible({
        timeout: 15000,
      });
      await expect(getVisibleNoJsLookupCta(page)).toHaveAttribute(
        "href",
        "/user?username=Alpha49",
      );
    } finally {
      await context.close();
    }
  });
});
