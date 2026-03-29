import { gotoReady } from "../fixtures/browser-utils";
import { mockCardsRecord } from "../fixtures/mock-data";
import { expect, mockSuccessfulApiRoutes, test } from "../fixtures/test-utils";

test.use({ serviceWorkers: "block" });

test.describe("User page editor - save UX", () => {
  test("Ctrl+S triggers a minimal /api/store-cards payload", async ({
    page,
  }) => {
    const savePayloads: unknown[] = [];

    await test.step("Mock user, cards, preview, and save endpoints", async () => {
      await mockSuccessfulApiRoutes(page, {
        storeCards: async (route) => {
          const postData = route.request().postData();
          savePayloads.push(postData ? JSON.parse(postData) : null);

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              userId: mockCardsRecord.userId,
              updatedAt: "2025-01-01T00:00:00.000Z",
            }),
          });
        },
      });
    });

    await test.step("Load the user editor", async () => {
      await gotoReady(page, "/user/TestUser");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /testuser|your collection/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Your Cards" }),
      ).toBeVisible();
      await expect(page.getByTestId("card-tile-animeStats")).toBeVisible();
    });

    await test.step("Make an edit to enable saving", async () => {
      const animeToggle = page.getByRole("switch", {
        name: /toggle anime stats card/i,
      });
      await expect(animeToggle).toBeVisible();

      await expect(animeToggle).toHaveAttribute("aria-checked", "true", {
        timeout: 15000,
      });
      await animeToggle.click();
      await expect(animeToggle).toHaveAttribute("aria-checked", "false");
    });

    await test.step("Press Ctrl+S and capture the save payload", async () => {
      const startCount = savePayloads.length;
      await page.keyboard.press("Control+S");

      await expect
        .poll(() => savePayloads.length, { timeout: 5000 })
        .toBe(startCount + 1);

      const payload = savePayloads.at(-1) as Record<string, unknown>;
      expect(String(payload.userId)).toBe("123456");
      expect(payload.ifMatchUpdatedAt).toBe(mockCardsRecord.updatedAt);

      const cards = payload.cards as Array<Record<string, unknown>>;
      expect(Array.isArray(cards)).toBe(true);
      expect(cards).toHaveLength(1);
      expect(cards[0]?.cardName).toBe("animeStats");
      expect(cards[0]?.disabled).toBe(true);
    });

    await test.step("Editor should become clean after save", async () => {
      const saveButton = page.getByRole("button", { name: /save changes/i });
      await expect(saveButton).toBeDisabled();
    });
  });

  test("Discard confirmation reverts edits", async ({ page }) => {
    let saveCount = 0;

    await test.step("Mock endpoints", async () => {
      await mockSuccessfulApiRoutes(page, {
        storeCards: async (route) => {
          saveCount += 1;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              userId: mockCardsRecord.userId,
              updatedAt: "2025-01-01T00:00:00.000Z",
            }),
          });
        },
      });
    });

    await test.step("Load the user editor", async () => {
      await gotoReady(page, "/user/TestUser");
      await expect(
        page.getByRole("heading", { name: "Your Cards" }),
      ).toBeVisible();
    });

    await test.step("Toggle a card and then discard changes", async () => {
      const animeToggle = page.getByRole("switch", {
        name: /toggle anime stats card/i,
      });

      await expect(animeToggle).toHaveAttribute("aria-checked", "true", {
        timeout: 15000,
      });
      await animeToggle.click();
      await expect(animeToggle).toHaveAttribute("aria-checked", "false");

      await page
        .getByRole("button", { name: /discard unsaved changes/i })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /discard changes/i })
        .click();

      await expect(animeToggle).toHaveAttribute("aria-checked", "true");
      await expect(
        page.getByRole("button", { name: /save changes/i }),
      ).toBeDisabled();
    });

    await test.step("Discarding should stop any further save attempts", async () => {
      const settledSaveCount = saveCount;
      await expect
        .poll(() => saveCount, { timeout: 2500 })
        .toBe(settledSaveCount);
    });
  });

  test("Queued autosave surfaces conflict recovery and preserves edits after reload", async ({
    page,
  }) => {
    const savePayloads: Array<Record<string, unknown>> = [];
    const conflictUpdatedAt = "2025-02-02T00:00:10.000Z";
    const recoveredUpdatedAt = "2025-02-02T00:00:20.000Z";
    let storeCardsCallCount = 0;
    let getCardsCount = 0;
    let currentCardsRecord = structuredClone(mockCardsRecord);

    await test.step("Mock user, cards, preview, and conflict-on-first-save behavior", async () => {
      await mockSuccessfulApiRoutes(page, {
        getCards: async (route) => {
          getCardsCount += 1;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(currentCardsRecord),
          });
        },
        storeCards: async (route) => {
          storeCardsCallCount += 1;
          const postData = route.request().postData();
          const payload = postData
            ? (JSON.parse(postData) as Record<string, unknown>)
            : {};

          savePayloads.push(payload);

          if (storeCardsCallCount === 1) {
            currentCardsRecord = {
              ...currentCardsRecord,
              updatedAt: conflictUpdatedAt,
            };

            await route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                error:
                  "Conflict: data was updated elsewhere. Please reload and try again.",
                currentUpdatedAt: conflictUpdatedAt,
              }),
            });
            return;
          }

          currentCardsRecord = {
            ...currentCardsRecord,
            cards:
              (payload.cards as typeof mockCardsRecord.cards) ??
              currentCardsRecord.cards,
            updatedAt: recoveredUpdatedAt,
          };

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              userId: mockCardsRecord.userId,
              updatedAt: recoveredUpdatedAt,
            }),
          });
        },
      });
    });

    await test.step("Load the user editor and queue an autosave", async () => {
      await gotoReady(page, "/user/TestUser");
      await expect(
        page.getByRole("heading", { name: "Your Cards" }),
      ).toBeVisible();

      const animeToggle = page.getByRole("switch", {
        name: /toggle anime stats card/i,
      });

      await expect(animeToggle).toHaveAttribute("aria-checked", "true", {
        timeout: 15000,
      });
      await animeToggle.click();
      await expect(animeToggle).toHaveAttribute("aria-checked", "false");

      const saveStatus = page.locator('output[aria-live="polite"]');
      await expect(saveStatus).toContainText(/Auto-save in/i);

      const queuedStateObservedAt = Date.now();
      await expect
        .poll(
          async () => {
            const saveStatusText =
              (await saveStatus.textContent())
                ?.replaceAll(/\s+/g, " ")
                .trim() ?? "";

            return (
              Date.now() - queuedStateObservedAt >= 750 &&
              /Auto-save in/i.test(saveStatusText) &&
              savePayloads.length === 0
            );
          },
          {
            timeout: 1500,
          },
        )
        .toBe(true);
    });

    await test.step("Autosave should hit a save conflict and surface recovery UI", async () => {
      const saveButton = page.getByRole("button", { name: /save changes/i });

      await expect.poll(() => savePayloads.length, { timeout: 5000 }).toBe(1);

      expect(savePayloads[0]?.ifMatchUpdatedAt).toBe(mockCardsRecord.updatedAt);

      await expect(
        page.getByText(
          /another tab saved changes\. Reload to sync, then re-apply your edits\./i,
        ),
      ).toBeVisible();
      await expect(page.getByText("Out of sync")).toBeVisible();
      await expect(saveButton).toBeDisabled();
    });

    await test.step("Reload & keep edits should fetch the latest version and re-save the queued patch", async () => {
      const getCardsCountBeforeRecovery = getCardsCount;
      const animeToggle = page.getByRole("switch", {
        name: /toggle anime stats card/i,
      });

      await page.getByRole("button", { name: /reload & keep edits/i }).click();

      await expect
        .poll(() => getCardsCount > getCardsCountBeforeRecovery, {
          timeout: 5000,
        })
        .toBe(true);
      await expect.poll(() => savePayloads.length, { timeout: 10000 }).toBe(2);

      expect(savePayloads[1]?.ifMatchUpdatedAt).toBe(conflictUpdatedAt);

      const recoveredCards = savePayloads[1]?.cards as Array<
        Record<string, unknown>
      >;
      expect(Array.isArray(recoveredCards)).toBe(true);
      expect(recoveredCards).toHaveLength(1);
      expect(recoveredCards[0]?.cardName).toBe("animeStats");
      expect(recoveredCards[0]?.disabled).toBe(true);

      await expect(
        page.getByRole("button", { name: /reload & keep edits/i }),
      ).toHaveCount(0);
      await expect(page.getByText(/Auto-save in/i)).toHaveCount(0);
      await expect(animeToggle).toHaveAttribute("aria-checked", "false");
      await expect(
        page.getByRole("button", { name: /save changes/i }),
      ).toBeDisabled();
    });
  });
});
