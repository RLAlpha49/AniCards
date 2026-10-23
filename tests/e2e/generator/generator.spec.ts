import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";
import { mockUserRecord, mockCardsRecord } from "../fixtures/mock-data";

/**
 * Stubs every request a card generation makes, so the generator runs without
 * reaching AniList or Redis.
 * @param page - The page under test.
 * @source
 */
async function stubGenerateEndpoints(page: import("@playwright/test").Page) {
  await page.route("**/api/card**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg width="450" height="195"><rect fill="#1a1a2e" width="450" height="195"/></svg>',
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });

  await page.route("**/api/anilist**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const query: string = body.query ?? "";

    if (query.includes("GetUserId")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ User: { id: 542244 } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        User: {
          statistics: {
            anime: {
              count: 10,
              episodesWatched: 100,
              minutesWatched: 2400,
              meanScore: 80,
              standardDeviation: 5,
            },
            manga: {
              count: 4,
              chaptersRead: 40,
              volumesRead: 8,
              meanScore: 78,
              standardDeviation: 4,
            },
          },
        },
      }),
    });
  });

  await page.route("**/api/get-user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockUserRecord),
    });
  });

  await page.route("**/api/get-cards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCardsRecord),
    });
  });

  await page.route("**/api/store-**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe("Card generator", () => {
  test.beforeEach(async ({ page }) => {
    await stubGenerateEndpoints(page);
  });

  test("counts each selection in the rail", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");

    const rail = page.getByRole("navigation", { name: /generator steps/i });
    await expect(rail.getByRole("button", { name: /^Cards/ })).toContainText(
      "0",
    );

    await generator.selectCardType("Anime Statistics");
    await generator.selectCardType("Manga Genres");

    await expect(rail.getByRole("button", { name: /^Cards/ })).toContainText(
      "2",
    );
  });

  test("filters the catalogue by search", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");

    // Row buttons are named after their card, so "Add all" group shortcuts are
    // excluded by requiring the card title to follow the verb.
    const rows = page.getByRole("button", {
      name: /^(add|remove) (?!all\b).+/i,
    });
    const initial = await rows.count();
    expect(initial).toBeGreaterThan(10);

    await page
      .getByRole("searchbox", { name: /search cards/i })
      .fill("Voice Actors");
    await expect.poll(async () => rows.count()).toBeLessThan(initial);

    await expect(
      page.getByRole("button", { name: /^add voice actors$/i }),
    ).toBeVisible();
  });

  test("shows an empty state when the search matches nothing", async ({
    page,
  }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");

    await page
      .getByRole("searchbox", { name: /search cards/i })
      .fill("no such card exists");

    await expect(
      page.getByRole("heading", { name: /no card matches that/i }),
    ).toBeVisible();
  });

  test("offers every profile and favourites summary variation", async ({
    page,
  }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");

    await generator.selectCardType("Profile Overview");
    const profileVariations = page
      .getByRole("group", { name: /Profile Overview variations/i })
      .first();
    await expect(
      profileVariations.getByRole("button", { name: "Compact" }),
    ).toBeVisible();
    await expect(
      profileVariations.getByRole("button", { name: "Minimal" }),
    ).toBeVisible();

    await generator.selectCardType("Favourites Summary");
    const favouritesVariations = page
      .getByRole("group", { name: /Favourites Summary variations/i })
      .first();
    await expect(
      favouritesVariations.getByRole("button", { name: "Compact" }),
    ).toBeVisible();
    await expect(
      favouritesVariations.getByRole("button", { name: "Minimal" }),
    ).toBeVisible();
  });

  test("keeps card options when a card is removed and re-added", async ({
    page,
  }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");

    await generator.selectCardType("Anime Statistics");
    const animeVariations = page
      .getByRole("group", { name: /Anime Statistics variations/i })
      .first();
    await animeVariations.getByRole("button", { name: "Minimal" }).click();
    await generator.selectCardType("Anime Statistics");
    await generator.selectCardType("Anime Statistics");
    await expect(
      animeVariations.getByRole("button", { name: "Minimal" }),
    ).toHaveAttribute("aria-pressed", "true");

    await generator.selectCardType("Voice Actors");
    const favouritesToggle = page.getByRole("button", {
      name: "Favourites",
      exact: true,
    });
    await favouritesToggle.click();
    await generator.selectCardType("Voice Actors");
    await generator.selectCardType("Voice Actors");
    await expect(favouritesToggle).toHaveAttribute("aria-pressed", "true");
  });

  test("switching a palette updates the preview", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.goToStep("Palette");

    const previewImage = page.locator("aside img").first();
    const before = await previewImage.getAttribute("src");

    await page.getByRole("button", { name: /^Coral$/ }).click();

    await expect
      .poll(async () => previewImage.getAttribute("src"))
      .not.toBe(before);
  });

  test("debounces rapid palette edits before requesting a preview", async ({
    page,
  }) => {
    const previewRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.get("cardType") === "animeStats") {
        previewRequests.push(request.url());
      }
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await expect.poll(() => previewRequests.length).toBe(1);
    await generator.goToStep("Palette");

    const previousRequestCount = previewRequests.length;
    const titleColor = page.getByRole("textbox", {
      name: /title colour as hex/i,
    });
    await titleColor.fill("#112233");
    await titleColor.fill("#223344");
    await titleColor.fill("#334455");

    await expect
      .poll(() => previewRequests.length, { timeout: 5000 })
      .toBe(previousRequestCount + 1);
    expect(
      new URL(previewRequests[previewRequests.length - 1]).searchParams.get(
        "titleColor",
      ),
    ).toBe("#334455");
  });

  test("does not save or submit an invalid palette", async ({ page }) => {
    let storeRequests = 0;
    page.on("request", (request) => {
      if (/\/api\/store-(users|cards)$/.test(new URL(request.url()).pathname)) {
        storeRequests += 1;
      }
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.enterUsername("TestUser");
    await generator.goToStep("Palette");
    await page
      .getByRole("textbox", { name: /title colour as hex/i })
      .fill("#12345");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");

    const initialSettings = await page.evaluate(() => ({
      cards: localStorage.getItem("anicards-card-settings"),
      user: localStorage.getItem("anicards-user-preferences"),
    }));

    await generator.clickGenerate();

    await expect(generator.getStepHeading("Palette")).toBeVisible();
    await expect(
      page.getByText(/enter valid colours in step two before generating/i),
    ).toBeVisible();
    expect(storeRequests).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          cards: localStorage.getItem("anicards-card-settings"),
          user: localStorage.getItem("anicards-user-preferences"),
        })),
      )
      .toEqual(initialSettings);

    await page
      .getByRole("textbox", { name: /title colour as hex/i })
      .fill("#123456");
    await page.getByRole("checkbox", { name: /frame off/i }).check();
    await page
      .getByRole("textbox", { name: /card border colour as hex/i })
      .fill("#12345");
    await page.getByRole("checkbox", { name: /frame on/i }).uncheck();
    await generator.clickGenerate();

    await expect(generator.getStepHeading("Palette")).toBeVisible();
    expect(storeRequests).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          cards: localStorage.getItem("anicards-card-settings"),
          user: localStorage.getItem("anicards-user-preferences"),
        })),
      )
      .toEqual(initialSettings);
  });

  test("generates the selected cards and lands on the user page", async ({
    page,
  }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();

    await generator.enterUsername("TestUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.clickGenerate();

    // The generator pushes to the user page on the client, so poll the URL.
    await expect.poll(() => page.url(), { timeout: 30000 }).toContain("/user");
    expect(page.url()).toContain("username=TestUser");
  });

  test("submits independent status colours and restores the last generation", async ({
    page,
  }) => {
    const submittedPayloads: Array<{
      cards: Array<Record<string, unknown>>;
    }> = [];
    const submittedUsernames: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith("/api/store-cards")) {
        submittedPayloads.push(
          request.postDataJSON() as { cards: Array<Record<string, unknown>> },
        );
      }
      if (pathname.endsWith("/api/store-users")) {
        const payload = request.postDataJSON() as { username: string };
        submittedUsernames.push(payload.username);
      }
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.enterUsername("  TestUser  ");
    await generator.goToStep("Palette");
    await page.getByRole("button", { name: /^Coral$/i }).click();
    await page.getByRole("checkbox", { name: /frame off/i }).check();
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    const animeVariations = page
      .getByRole("group", { name: /Anime Statistics variations/i })
      .first();
    await animeVariations.getByRole("button", { name: "Minimal" }).click();
    await generator.selectCardType("Anime Genres");
    const genreVariations = page
      .getByRole("group", { name: /Anime Genres variations/i })
      .first();
    await genreVariations.getByRole("button", { name: "Pie Chart" }).click();
    await generator.selectCardType("Voice Actors");
    await page.getByRole("button", { name: "Favourites", exact: true }).click();
    await generator.selectCardType("Favourites Grid");
    const gridVariations = page
      .getByRole("group", { name: /Favourites Grid variations/i })
      .first();
    await gridVariations.getByRole("button", { name: "Mixed" }).click();
    await generator.selectCardType("Anime Status Distribution");
    await generator.selectCardType("Manga Status Distribution");
    await generator.goToStep("Finish");

    await page
      .getByRole("checkbox", { name: /Use fixed anime status colours/i })
      .check();
    await page
      .getByRole("checkbox", { name: /Show percentages on pie charts/i })
      .check();
    await expect(
      page.getByRole("checkbox", { name: /Use fixed manga status colours/i }),
    ).not.toBeChecked();
    await page
      .getByRole("spinbutton", { name: /Favourites grid columns/i })
      .fill("4");
    await page
      .getByRole("spinbutton", { name: /Favourites grid rows/i })
      .fill("2");

    await generator.pressKey("Control+Enter");
    await expect.poll(() => page.url(), { timeout: 30000 }).toContain("/user");
    await expect.poll(() => submittedPayloads.length).toBe(1);
    expect(submittedUsernames).toEqual(["TestUser"]);
    expect(page.url()).toContain("username=TestUser");

    const cards = submittedPayloads[0].cards;
    expect(cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardName: "animeStats",
          variation: "minimal",
          titleColor: "#ff6b6b",
          backgroundColor: "#ffe8e8",
          textColor: "#2d3436",
          circleColor: "#ff6b6b",
          colorPreset: "coral",
          borderColor: "#e4e2e2",
          borderRadius: 8,
        }),
        expect.objectContaining({
          cardName: "animeGenres",
          variation: "pie",
          showPiePercentages: true,
        }),
        expect.objectContaining({
          cardName: "animeVoiceActors",
          showFavorites: true,
        }),
        expect.objectContaining({
          cardName: "favoritesGrid",
          variation: "mixed",
          gridCols: 4,
          gridRows: 2,
        }),
        expect.objectContaining({
          cardName: "animeStatusDistribution",
          useStatusColors: true,
        }),
        expect.objectContaining({ cardName: "mangaStatusDistribution" }),
      ]),
    );
    expect(
      cards.find((card) => card.cardName === "mangaStatusDistribution"),
    ).not.toHaveProperty("useStatusColors");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("anicards-user-preferences");
          if (!raw) return null;
          return JSON.parse(raw).state?.defaultUsername ?? null;
        }),
      )
      .toBe("TestUser");

    await generator.goto();
    await expect(generator.getUsernameInput()).toHaveValue("TestUser");
    await generator.goToStep("Cards");
    const restoredVariations = page
      .getByRole("group", { name: /Anime Statistics variations/i })
      .first();
    await expect(
      restoredVariations.getByRole("button", { name: "Minimal" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: /^remove anime status distribution$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await generator.goToStep("Palette");
    await expect(
      page.getByRole("button", { name: /^Coral$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await generator.goToStep("Finish");
    await expect(
      page.getByRole("checkbox", { name: /Use fixed anime status colours/i }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Use fixed manga status colours/i }),
    ).not.toBeChecked();
  });

  test("retries a transient card-store failure", async ({ page }) => {
    let cardStoreAttempts = 0;
    await page.route("**/api/store-cards", async (route) => {
      cardStoreAttempts += 1;
      await route.fulfill({
        status: cardStoreAttempts === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify({ success: cardStoreAttempts > 1 }),
      });
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.enterUsername("TestUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.clickGenerate();

    await expect.poll(() => page.url(), { timeout: 30000 }).toContain("/user");
    expect(cardStoreAttempts).toBe(2);
  });

  test("locks generator controls and avoids a late redirect", async ({
    page,
  }) => {
    let releaseStoreCards: (() => void) | undefined;
    let signalStoreCardsStarted!: () => void;
    const storeCardsStarted = new Promise<void>((resolve) => {
      signalStoreCardsStarted = resolve;
    });

    await page.route("**/api/store-cards", async (route) => {
      signalStoreCardsStarted();
      await new Promise<void>((resolve) => {
        releaseStoreCards = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.enterUsername("TestUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.clickGenerate();
    await storeCardsStarted;

    const controls = page.locator(
      '[aria-label="Card generator controls"][aria-busy="true"]',
    );
    await expect(controls).toHaveAttribute("inert");
    await expect(
      page.getByRole("button", { name: /^generate 1 card$/i }),
    ).toBeDisabled();

    const mobileNavigation = page.getByRole("button", {
      name: /open navigation menu/i,
    });
    if (await mobileNavigation.isVisible()) await mobileNavigation.click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    const unexpectedRedirect = page
      .waitForURL(/\/user/, { timeout: 1000 })
      .then(() => true)
      .catch((error: Error) => {
        if (error.name === "TimeoutError") return false;
        throw error;
      });
    releaseStoreCards?.();
    expect(await unexpectedRedirect).toBe(false);
    await expect(page).toHaveURL(/\/$/);
  });

  test("reports an unknown AniList user without storing cards", async ({
    page,
  }) => {
    let cardStoreAttempts = 0;
    await page.route("**/api/anilist", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ User: null }),
      });
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/api/store-cards")) {
        cardStoreAttempts += 1;
      }
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.enterUsername("UnknownUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.clickGenerate();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/not found/i);
    expect(cardStoreAttempts).toBe(0);
  });

  test("reports an exhausted AniList network retry", async ({ page }) => {
    let aniListAttempts = 0;
    await page.route("**/api/anilist", async (route) => {
      aniListAttempts += 1;
      await route.abort("failed");
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await generator.enterUsername("TestUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.clickGenerate();

    await expect(page.getByRole("dialog").first()).toBeVisible({
      timeout: 20000,
    });
    await expect.poll(() => aniListAttempts).toBe(4);
  });

  test("carries the card frame into the preview", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();

    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.goToStep("Palette");

    const previewImage = page.locator("aside img").first();
    const before = await previewImage.getAttribute("src");
    expect(before).not.toContain("borderColor");

    await page.getByRole("checkbox", { name: /frame off/i }).check();

    await expect
      .poll(async () => previewImage.getAttribute("src"))
      .toContain("borderColor");

    // The rendered SVG has to draw the border, not just accept the parameter.
    const url = await previewImage.getAttribute("src");
    const stroke = await page.evaluate(async (svgUrl) => {
      const response = await fetch(svgUrl!);
      const text = await response.text();
      return /stroke="#e4e2e2"/i.test(text);
    }, url);
    expect(stroke).toBe(true);
  });

  test("edits a gradient stop", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();

    // The preview needs a card before it renders anything to inspect.
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.goToStep("Palette");

    await page.getByRole("button", { name: /^Gradient$/ }).click();
    await page.getByRole("button", { name: /anilist dark gradient/i }).click();

    // A gradient field starts collapsed, so the stop list is not on screen yet.
    await page.locator('[class*="gradientToggle"]').first().click();
    await expect(page.locator('[class*="gradientStop"]').first()).toBeVisible();

    const angle = page.getByLabel(/title gradient angle/i);
    const beforeAngle = await angle.inputValue();
    await angle.fill("45");
    await expect(angle).not.toHaveValue(beforeAngle);

    // The preview is painted from the edited gradient, not from a preset name.
    const previewImage = page.locator("aside img").first();
    await expect
      .poll(async () =>
        decodeURIComponent((await previewImage.getAttribute("src")) ?? ""),
      )
      .toContain('"angle":45');
  });

  test("explains a setting with a before and after card", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();

    await generator.enterUsername("TestUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.goToStep("Finish");

    const demos = page.locator('[class*="optionDemoWrap"]');
    await expect(demos.first()).toBeVisible();

    const statusRow = page.locator('[class*="optionRow"]').first();
    await statusRow.hover();

    const sources = await demos
      .first()
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute("src") ?? ""),
      );

    expect(sources).toHaveLength(2);
    expect(sources.some((src) => src.includes("statusColors=true"))).toBe(true);
    expect(sources.some((src) => src.includes("statusColors=false"))).toBe(
      true,
    );
  });

  test("sets favourites on every eligible card at once", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();

    await generator.enterUsername("TestUser");
    await generator.goToStep("Cards");
    await generator.selectCardType("Voice Actors");
    await generator.selectCardType("Animation Studios");
    await generator.goToStep("Finish");

    await page.getByRole("button", { name: /^show on all$/i }).click();

    const labels = page.locator('[class*="reviewFavourite"]');
    await expect(labels).toHaveCount(2);
    await expect(labels.first()).toContainText(/hearts on/i);
    await expect(labels.nth(1)).toContainText(/hearts on/i);
  });

  test("restores saved favourites when no variation is saved", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "anicards-card-settings",
        JSON.stringify({
          state: {
            defaultCardTypes: ["animeVoiceActors"],
            defaultVariants: {},
            defaultShowFavoritesByCard: { animeVoiceActors: true },
          },
          version: 1,
        }),
      );
    });

    const generator = new GeneratorPage(page);
    await generator.goto();
    await expect.poll(() => generator.getSelectedCardsCount()).toBe(1);
    await generator.goToStep("Cards");

    await expect(
      page.getByRole("button", { name: "Favourites", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("reports what is missing instead of generating", async ({ page }) => {
    const generator = new GeneratorPage(page);
    await generator.goto();

    await expect(generator.getUsernameInput()).toHaveValue("");

    // Only the name is missing, so the generator stays on the Finish step and
    // tells the visitor what to fix.
    await generator.goToStep("Cards");
    await generator.selectCardType("Anime Statistics");
    await generator.goToStep("Finish");
    await generator.clickGenerate();

    await expect(
      page.getByText(/add an anilist username, then generate again/i),
    ).toBeVisible();
    await expect(generator.getStepHeading("Username")).toBeVisible();
  });

  test("keeps the rail reachable on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const generator = new GeneratorPage(page);
    await generator.goto();

    const trigger = page.getByRole("button", { name: /^steps/i });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const rail = page.getByRole("navigation", { name: /generator steps/i });
    await expect(rail).toBeVisible();
    await rail.getByRole("button", { name: /^Cards/ }).click();

    await expect(generator.getStepHeading("Cards")).toBeVisible();
  });
});
