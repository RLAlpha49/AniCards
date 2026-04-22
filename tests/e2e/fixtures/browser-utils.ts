import {
  type Browser,
  type BrowserContextOptions,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/utils/google-analytics";

type ProjectPageOptions = {
  blockHydrationScripts?: boolean;
  javaScriptEnabled?: boolean;
  reducedMotion?: BrowserContextOptions["reducedMotion"];
  viewport?: BrowserContextOptions["viewport"];
};

const themeControlSelector = [
  '[aria-label="Toggle color mode"]',
  '[aria-label="Switch to dark mode"]',
  '[aria-label="Switch to light mode"]',
].join(", ");

const E2E_ANALYTICS_CONSENT_STATE = "denied";

async function seedAnalyticsConsentPreference(page: Page): Promise<void> {
  await page.addInitScript(
    ({ consentState, storageKey }) => {
      try {
        globalThis.localStorage.setItem(storageKey, consentState);
      } catch {
        // Some browser sandboxes can temporarily block storage access. In that
        // case the shared dismiss helper still handles the visible consent UI.
      }
    },
    {
      consentState: E2E_ANALYTICS_CONSENT_STATE,
      storageKey: ANALYTICS_CONSENT_STORAGE_KEY,
    },
  );
}

function resolveProjectContextOptions(
  testInfo: TestInfo,
): BrowserContextOptions {
  const projectUse = testInfo.project.use as BrowserContextOptions;

  return {
    baseURL:
      typeof projectUse.baseURL === "string" ? projectUse.baseURL : undefined,
    colorScheme: projectUse.colorScheme,
    deviceScaleFactor: projectUse.deviceScaleFactor,
    extraHTTPHeaders: projectUse.extraHTTPHeaders
      ? { ...projectUse.extraHTTPHeaders }
      : undefined,
    hasTouch: projectUse.hasTouch,
    isMobile: projectUse.isMobile,
    javaScriptEnabled: projectUse.javaScriptEnabled,
    locale: projectUse.locale,
    permissions: projectUse.permissions
      ? [...projectUse.permissions]
      : undefined,
    reducedMotion: projectUse.reducedMotion,
    screen: projectUse.screen ? { ...projectUse.screen } : undefined,
    timezoneId: projectUse.timezoneId,
    userAgent: projectUse.userAgent,
    viewport: projectUse.viewport ? { ...projectUse.viewport } : undefined,
  };
}

export function getConfiguredBaseUrl(testInfo: TestInfo): string {
  const configuredBaseUrl =
    typeof testInfo.project.use.baseURL === "string"
      ? testInfo.project.use.baseURL
      : undefined;

  if (!configuredBaseUrl) {
    throw new Error("Expected the Playwright project to define a baseURL");
  }

  return configuredBaseUrl;
}

export async function createProjectPage(
  browser: Browser,
  testInfo: TestInfo,
  options: ProjectPageOptions = {},
) {
  const projectContextOptions = resolveProjectContextOptions(testInfo);
  const context = await browser.newContext({
    ...projectContextOptions,
    javaScriptEnabled:
      options.javaScriptEnabled ??
      projectContextOptions.javaScriptEnabled ??
      true,
    reducedMotion: options.reducedMotion ?? projectContextOptions.reducedMotion,
    viewport: options.viewport ?? projectContextOptions.viewport,
  });
  const page = await context.newPage();

  await seedAnalyticsConsentPreference(page);

  if (options.blockHydrationScripts) {
    await page.route("**/_next/static/**", async (route) => {
      if (route.request().resourceType() === "script") {
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });
  }

  return {
    context,
    page,
    url: new URL("/", getConfiguredBaseUrl(testInfo)).toString(),
  };
}

export async function waitForAppReady(page: Page): Promise<void> {
  const themeControl = page.locator(themeControlSelector).first();
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByRole("banner")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });

  await expect
    .poll(
      async () => {
        const readyState = await page.evaluate(() => document.readyState);

        if (readyState === "loading") {
          return "loading";
        }

        if ((await themeControl.count()) === 0) {
          return "ready";
        }

        return (await themeControl.isVisible()) ? "ready" : "pending";
      },
      {
        message:
          "Expected the app shell controls to become interactive without relying on the load event.",
        timeout: 15000,
      },
    )
    .toBe("ready");
}

export async function dismissAnalyticsPromptIfVisible(
  page: Page,
): Promise<boolean> {
  const dismissButton = page.getByRole("button", {
    name: /keep it off/i,
  });

  if (await dismissButton.isVisible()) {
    await dismissButton.click();
    await expect(dismissButton).toBeHidden({ timeout: 5000 });
    return true;
  }

  return false;
}

async function settleAnalyticsControls(page: Page): Promise<void> {
  const analyticsToggle = page.getByRole("button", {
    name: /analytics (on|off)/i,
  });

  try {
    await expect
      .poll(
        async () => {
          if (await dismissAnalyticsPromptIfVisible(page)) {
            return "dismissed";
          }

          return (await analyticsToggle.isVisible()) ? "ready" : "pending";
        },
        {
          message:
            "Expected analytics controls to settle without fixed sleep loops.",
          timeout: 5000,
        },
      )
      .not.toBe("pending");
  } catch {
    // Some routes never render analytics controls at all; that is acceptable.
  }
}

export async function gotoReady(page: Page, url: string): Promise<void> {
  await seedAnalyticsConsentPreference(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
  await settleAnalyticsControls(page);
}

export async function expectHomeNoJsMobileFallback(page: Page): Promise<void> {
  const mobileNavigationFallback = page.locator(
    '[data-mobile-navigation-fallback="true"]',
  );

  await expect(
    page.getByRole("heading", { level: 1, name: /your anime/i }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("link", { name: /^get started$/i })).toBeVisible({
    timeout: 15000,
  });
  await expect(mobileNavigationFallback).toBeVisible({ timeout: 15000 });
  await expect(
    mobileNavigationFallback.getByRole("link", { name: /^search$/i }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-mobile-menu-toggle="true"]')).toBeHidden({
    timeout: 15000,
  });
}

export async function waitForUiReady(target: Locator): Promise<void> {
  await expect(target).toBeVisible({ timeout: 15000 });

  try {
    await expect(target).toHaveAttribute("data-ui-ready", "true", {
      timeout: 5000,
    });
  } catch {
    // Some browsers can paint the interactive editor before this mount flag settles.
  }
}

export async function clickAnchorAndExpectUrl(
  page: Page,
  locator: Locator,
  urlPattern: RegExp,
): Promise<void> {
  const clickAnchor = async () => {
    await dismissAnalyticsPromptIfVisible(page);
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeVisible({ timeout: 15000 });
    await locator.click();
  };

  try {
    await clickAnchor();
  } catch (error) {
    const dismissButton = page.getByRole("button", {
      name: /keep it off/i,
    });

    if (!(await dismissButton.isVisible())) {
      throw error;
    }

    await dismissButton.click();
    await clickAnchor();
  }

  await expect(page).toHaveURL(urlPattern, { timeout: 15000 });
}
