import type { Locator, Page } from "@playwright/test";

import {
  createProjectPage,
  gotoReady,
  waitForUiReady,
} from "../fixtures/browser-utils";
import { expect, test } from "../fixtures/test-utils";

const MOBILE_VIEWPORT = {
  width: 393,
  height: 851,
};

function useMockFixture<T>(fixture: T): T {
  return fixture;
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

function getSearchNoscriptFallbackSurface(page: Page): Locator {
  return page.locator("[data-search-noscript-fallback='true']").first();
}

async function expectMinTouchTarget(locator: Locator, label: string) {
  await expect(locator).toBeVisible();

  const box = await locator.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return {
      height: rect.height,
      width: rect.width,
    };
  });

  expect(
    Math.round(box.width),
    `${label} width should round to the 44px mobile touch-target baseline`,
  ).toBeGreaterThanOrEqual(44);
  expect(
    Math.round(box.height),
    `${label} height should round to the 44px mobile touch-target baseline`,
  ).toBeGreaterThanOrEqual(44);
}

async function expectContainedWithinSurface(options: {
  label: string;
  locator: Locator;
  page: Page;
  surface: Locator;
}) {
  const { label, locator, page, surface } = options;

  await expect(surface).toBeVisible();
  await expect(locator).toBeVisible();

  const [surfaceBox, targetBox] = await Promise.all([
    surface.evaluate((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    }),
    locator.evaluate((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    }),
  ]);

  const viewport = page.viewportSize();

  if (!viewport) {
    throw new Error(
      "Expected a configured viewport for mobile fallback checks",
    );
  }

  expect(
    targetBox.left,
    `${label} should stay within the fallback surface`,
  ).toBeGreaterThanOrEqual(surfaceBox.left - 1);
  expect(
    targetBox.right,
    `${label} should stay within the fallback surface`,
  ).toBeLessThanOrEqual(surfaceBox.right + 1);
  expect(
    targetBox.top,
    `${label} should stay within the fallback surface`,
  ).toBeGreaterThanOrEqual(surfaceBox.top - 1);
  expect(
    targetBox.right,
    `${label} should stay within the mobile viewport width`,
  ).toBeLessThanOrEqual(viewport.width + 1);
}

test.describe("User page mobile ergonomics", () => {
  test("uses the touch-first mobile editor shell contract", async ({
    page,
    mockSuccessfulApi,
  }) => {
    useMockFixture(mockSuccessfulApi);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await gotoReady(page, "/user/TestUser");

    const editorMain = page.getByTestId("user-page-editor-main");
    await waitForUiReady(editorMain);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /testuser|your collection/i,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { level: 2, name: /your cards/i }),
    ).toBeVisible({ timeout: 15000 });

    const menuToggle = page.getByRole("button", { name: /open menu/i });
    await expect(menuToggle).toBeVisible();

    const menuToggleTouchAction = await menuToggle.evaluate(
      (node) => getComputedStyle(node as HTMLElement).touchAction,
    );

    expect(menuToggleTouchAction).toBe("manipulation");

    const viewport = page.viewportSize();
    await editorMain.scrollIntoViewIfNeeded();

    const editorBox = await editorMain.evaluate((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
      };
    });

    expect(viewport).not.toBeNull();
    expect(editorBox.height).toBeGreaterThan(0);

    if (!viewport) {
      throw new Error("Expected a mobile viewport and visible editor surface");
    }

    expect(editorBox.width).toBeGreaterThan(viewport.width - 64);

    const tile = page.getByTestId("card-tile-animeStats");
    await expect(tile).toBeVisible();
    await expect(
      tile.getByRole("button", { name: /toggle actions for/i }),
    ).toHaveCount(0);

    await expect(
      tile.getByRole("switch", { name: /toggle anime stats card/i }),
    ).toBeVisible();

    const disabledTile = page.getByTestId("card-tile-mangaStats");
    await expect(
      disabledTile.getByRole("status", { name: /card disabled/i }),
    ).toBeVisible();
  });

  test("keeps editor controls and overlays touch-safe on mobile", async ({
    page,
    mockSuccessfulApi,
  }) => {
    useMockFixture(mockSuccessfulApi);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await gotoReady(page, "/user/TestUser");

    const tile = page.getByTestId("card-tile-animeStats");
    await expect(tile).toBeVisible();

    const infoButtons = page.locator('[data-tour="card-info"]');
    const settingsButton = tile.locator('[data-tour="card-settings"]');
    const expandButton = tile.locator('[data-tour="card-expand"]');
    const copyButton = tile.getByRole("button", { name: /^copy copy url$/i });

    if ((await infoButtons.count()) > 0) {
      await expect(infoButtons.first()).toBeVisible();
    }
    await expect(settingsButton).toBeVisible();
    await expect(expandButton).toBeVisible();
    await expect(copyButton).toBeVisible();

    await settingsButton.click();

    const settingsDialog = page.getByRole("dialog", {
      name: /anime stats settings/i,
    });
    await expect(settingsDialog).toBeVisible();

    const tabList = settingsDialog.getByRole("tablist");
    await expect(tabList).toBeVisible();
    await expect(
      settingsDialog.getByRole("tab", { name: /^colors$/i }),
    ).toBeVisible();
    await expect(
      settingsDialog.getByRole("tab", { name: /^border$/i }),
    ).toBeVisible();
    await expect(
      settingsDialog.getByRole("button", { name: /^close$/i }),
    ).toBeVisible();

    await settingsDialog.getByRole("button", { name: /^close$/i }).click();
    await expect(settingsDialog).toHaveCount(0);

    const variantSelectTrigger = tile.getByRole("combobox", {
      name: /^variant$/i,
    });
    const variantInfoButton = tile.getByRole("button", {
      name: /^variant info$/i,
    });
    await expect(variantInfoButton).toBeVisible();
    await expect(variantSelectTrigger).toBeVisible();
    await variantSelectTrigger.click();

    const variantListbox = page.getByRole("listbox");
    await expect(variantListbox).toBeVisible();

    await page.keyboard.press("Escape");

    const moreActionsButton = page.getByRole("button", {
      name: /^more(?: editor)? actions$/i,
    });
    await moreActionsButton.scrollIntoViewIfNeeded();
    await moreActionsButton.click();

    const resetAllButton = page.getByRole("button", { name: /^reset all$/i });
    const moreActionsPopover = page
      .locator("[data-radix-popper-content-wrapper] > div")
      .filter({ has: resetAllButton });
    await expect(moreActionsPopover).toBeVisible();
    await expect(resetAllButton).toBeVisible();
    await resetAllButton.click();

    const resetAlertDialog = page.getByRole("alertdialog", {
      name: /reset all cards to global settings\?/i,
    });
    await expect(resetAlertDialog).toBeVisible();
    await expect(
      resetAlertDialog.getByRole("button", { name: /^cancel$/i }),
    ).toBeVisible();
    await expect(
      resetAlertDialog.getByRole("button", { name: /^reset all$/i }),
    ).toBeVisible();

    await resetAlertDialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(resetAlertDialog).toHaveCount(0);

    const reorderButton = page.getByRole("button", { name: /^reorder$/i });
    await reorderButton.scrollIntoViewIfNeeded();
    await reorderButton.click();

    const reorderOptionsButton = tile.getByRole("button", {
      name: /reorder options for anime stats/i,
    });
    const dragHandle = tile.locator('[data-tour="card-drag-handle"]');
    await expect(reorderOptionsButton).toBeVisible();
    await expect(dragHandle).toBeVisible();

    await reorderOptionsButton.click();
    await expect(
      page.getByRole("button", { name: /move anime stats earlier/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /move anime stats later/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Mobile progressive enhancement", () => {
  test("keeps the mobile search flow usable without JavaScript @mobile-lite", async ({
    browser,
  }, testInfo) => {
    const { context, page, url } = await createProjectPage(browser, testInfo, {
      javaScriptEnabled: false,
      viewport: MOBILE_VIEWPORT,
    });

    try {
      await page.goto(new URL("/search", url).toString(), {
        waitUntil: "load",
      });

      const fallbackSurface = getSearchNoscriptFallbackSurface(page);
      const usernameInput = getVisibleNoJsSearchInput(page);
      const submitButton = getVisibleNoJsSearchSubmitButton(page);

      expect(page.viewportSize()).toEqual(MOBILE_VIEWPORT);
      await expectContainedWithinSurface({
        label: "Search fallback input",
        locator: usernameInput,
        page,
        surface: fallbackSurface,
      });
      await expect(usernameInput).toBeVisible({ timeout: 15000 });
      await expectMinTouchTarget(usernameInput, "Search fallback input");
      await usernameInput.fill("Alpha49");
      await expectContainedWithinSurface({
        label: "Search fallback submit button",
        locator: submitButton,
        page,
        surface: fallbackSurface,
      });
      await expectMinTouchTarget(submitButton, "Search fallback submit button");
      await submitButton.click();

      await expect(page).toHaveURL(/\/search\?query=Alpha49/i, {
        timeout: 15000,
      });

      const lookupResult = getVisibleNoJsLookupResult(page);
      const lookupCta = getVisibleNoJsLookupCta(page);

      await expect(lookupResult).toBeVisible({ timeout: 15000 });
      await expectContainedWithinSurface({
        label: "Search fallback lookup result",
        locator: lookupResult,
        page,
        surface: fallbackSurface,
      });
      await expect(lookupCta).toHaveAttribute("href", "/user?username=Alpha49");
      await expectContainedWithinSurface({
        label: "Search fallback continue CTA",
        locator: lookupCta,
        page,
        surface: fallbackSurface,
      });
      await expectMinTouchTarget(lookupCta, "Search fallback continue link");

      await lookupCta.click();
      await expect(page).toHaveURL(/\/user\?username=Alpha49/i, {
        timeout: 15000,
      });
    } finally {
      await context.close();
    }
  });

  test("keeps mobile navigation operable before hydration under reduced motion @mobile-lite", async ({
    browser,
  }, testInfo) => {
    const { context, page, url } = await createProjectPage(browser, testInfo, {
      blockHydrationScripts: true,
      reducedMotion: "reduce",
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("banner")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("heading", { level: 1, name: /your anime/i }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("link", { name: /^get started$/i }),
      ).toBeVisible({ timeout: 15000 });

      const featureHeading = page.getByRole("heading", {
        name: /the repertoire/i,
      });
      await featureHeading.scrollIntoViewIfNeeded();
      await expect(featureHeading).toBeVisible({ timeout: 15000 });

      const html = page.locator("html");
      await expect
        .poll(() =>
          html.evaluate(
            (node) => (node as HTMLElement).dataset.mobileMenuHydrated ?? null,
          ),
        )
        .toBeNull();

      const menuToggle = page.locator('[data-mobile-menu-toggle="true"]');
      const mobileNavigation = page.locator("#mobile-navigation");

      await expect(menuToggle).toBeVisible({ timeout: 15000 });
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");

      await menuToggle.click();

      await expect(mobileNavigation).toBeVisible({ timeout: 15000 });
      await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
      await expect(
        mobileNavigation.getByRole("link", { name: /^search$/i }),
      ).toBeVisible({ timeout: 15000 });

      await page.keyboard.press("Escape");

      await expect(mobileNavigation).toBeHidden({ timeout: 15000 });
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("link", { name: /^get started$/i }),
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });
});
