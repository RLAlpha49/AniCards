import {
  dismissAnalyticsPromptIfVisible,
  waitForAppReady,
} from "../fixtures/browser-utils";
import { expect, test } from "../fixtures/test-utils";

function useMockFixture<T>(fixture: T): T {
  return fixture;
}

async function gotoMockedUserErrorPage(
  page: Parameters<typeof waitForAppReady>[0],
  url: string,
): Promise<void> {
  await page.goto(url, { waitUntil: "commit" });
  await waitForAppReady(page);
  await dismissAnalyticsPromptIfVisible(page);
}

test.describe("User page error states (mocked API)", () => {
  test("shows non-retryable missing-user guidance when AniList cannot resolve the username", async ({
    page,
    mockUserNotFoundApi,
  }) => {
    useMockFixture(mockUserNotFoundApi);

    await gotoMockedUserErrorPage(page, "/user/MissingUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByText(/user not found|spelled correctly|exists on anilist/i),
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("button", { name: /try again/i })).toHaveCount(
      0,
    );

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });

  test("shows rate limit error with recovery link", async ({
    page,
    mockRateLimitedApi,
  }) => {
    useMockFixture(mockRateLimitedApi);

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
    useMockFixture(mockNetworkError);

    await gotoMockedUserErrorPage(page, "/user/NetworkErrorUser");

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
