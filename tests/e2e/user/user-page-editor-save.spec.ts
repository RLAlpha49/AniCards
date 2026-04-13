import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { gotoReady, waitForUiReady } from "../fixtures/browser-utils";
import { mockCardsRecord, mockUserStatsData } from "../fixtures/mock-data";
import { expect, mockSuccessfulApiRoutes, test } from "../fixtures/test-utils";

let realHandlerSeedCounter = 0;

const REAL_HANDLER_REQUIRED_ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

type BrowserJsonResponse = {
  ok: boolean;
  status: number;
  payload: unknown;
  text: string;
};

function readLocalEnvValues(): Record<string, string> {
  const values: Record<string, string> = {};

  for (const relativePath of [".env", ".env.local"]) {
    const absolutePath = resolve(process.cwd(), relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const source = readFileSync(absolutePath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = /^([A-Za-z_]\w*)=(.*)$/.exec(trimmed);
      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      const unquotedValue = rawValue.replaceAll(/^['"]|['"]$/g, "").trim();
      if (unquotedValue) {
        values[key] = unquotedValue;
      }
    }
  }

  return values;
}

const localEnvValues = readLocalEnvValues();

function getRuntimeEnvValue(
  key: (typeof REAL_HANDLER_REQUIRED_ENV_KEYS)[number],
) {
  const runtimeValue = process.env[key]?.trim();
  if (runtimeValue) {
    return runtimeValue;
  }

  return localEnvValues[key]?.trim() || undefined;
}

function getMissingRealHandlerEnvKeys(): string[] {
  return REAL_HANDLER_REQUIRED_ENV_KEYS.filter(
    (key) => !getRuntimeEnvValue(key),
  );
}

function isRealHandlerRunEnabled(): boolean {
  return process.env.PLAYWRIGHT_REAL_USER_E2E === "1";
}

function expectSuccessfulBrowserResponse(
  response: BrowserJsonResponse,
  context: string,
): void {
  if (response.ok) {
    return;
  }

  const details = response.text.trim() || JSON.stringify(response.payload);
  throw new Error(`${context} failed with ${response.status}: ${details}`);
}

async function fetchBrowserJson(
  page: Page,
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
): Promise<BrowserJsonResponse> {
  return page.evaluate(
    async ({ body, method, path: requestPath }) => {
      const response = await fetch(requestPath, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        payload,
        text,
      };
    },
    {
      path,
      method: options.method,
      body: options.body,
    },
  );
}

async function waitForUserEditorReady(page: Page): Promise<void> {
  const editor = page.getByTestId("user-page-editor-main");
  await waitForUiReady(editor);

  const firstToggle = editor
    .locator('[data-testid^="card-tile-"] [role="switch"]')
    .first();
  await expect(firstToggle).toBeVisible({ timeout: 15000 });
  await expect(firstToggle).toBeEnabled({ timeout: 15000 });
}

type EditorCardToggleTarget = {
  toggle: Locator;
  cardId: string;
  initialChecked: "true" | "false";
};

async function clickEditorToggle(toggle: Locator): Promise<void> {
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toBeEnabled({ timeout: 15000 });
  await toggle.click();
}

async function waitForCleanEditorState(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: /save changes/i }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /discard unsaved changes/i }),
  ).toBeDisabled();
  await expect(page.locator('output[aria-live="polite"]')).toContainText(
    /No changes/i,
  );
}

async function waitForDirtyEditorState(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: /save changes/i })).toBeEnabled(
    { timeout: 60000 },
  );
  await expect(
    page.getByRole("button", { name: /discard unsaved changes/i }),
  ).toBeEnabled({ timeout: 60000 });
}

async function waitForPendingSaveState(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await page.locator('output[aria-live="polite"]').textContent()) ?? "",
      { timeout: 10000 },
    )
    .toMatch(/Auto-save in|Saving|Out of sync/i);
}

async function getPrimaryEditorCardToggle(
  page: Page,
): Promise<EditorCardToggleTarget> {
  const cardTile = page.locator('[data-testid^="card-tile-"]').first();

  await expect(cardTile).toBeVisible({ timeout: 15000 });

  const testId = await cardTile.getAttribute("data-testid");
  const cardId = testId?.replace(/^card-tile-/, "") ?? "";

  if (!cardId) {
    throw new Error(
      "Expected to find a card tile test id for the primary toggle.",
    );
  }

  const toggle = cardTile.getByRole("switch").first();
  const initialChecked = await toggle.getAttribute("aria-checked");

  if (initialChecked !== "true" && initialChecked !== "false") {
    throw new Error(
      "Expected the primary toggle to expose an aria-checked state.",
    );
  }

  return {
    toggle,
    cardId,
    initialChecked,
  };
}

function expectSavedTogglePayload(
  payloadCard: Record<string, unknown> | undefined,
) {
  expect(typeof payloadCard?.cardName).toBe("string");

  if (payloadCard && "disabled" in payloadCard) {
    expect(typeof payloadCard.disabled).toBe("boolean");
  }
}

test.describe("User page editor - save UX", () => {
  test("saving submits a minimal /api/store-cards payload", async ({
    page,
  }, testInfo) => {
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
      await waitForUserEditorReady(page);
      await waitForCleanEditorState(page);
    });

    await test.step("Make an edit to enable saving", async () => {
      const targetToggle = await getPrimaryEditorCardToggle(page);

      await clickEditorToggle(targetToggle.toggle);
      await expect
        .poll(async () => targetToggle.toggle.getAttribute("aria-checked"), {
          timeout: 15000,
        })
        .toBe(targetToggle.initialChecked === "true" ? "false" : "true");
      await waitForDirtyEditorState(page);
    });

    await test.step("Press Ctrl+S and capture the latest save payload", async () => {
      const saveButton = page.getByRole("button", { name: /save changes/i });
      const saveShortcut =
        testInfo.project.name === "firefox" ? "Meta+S" : "Control+S";

      await saveButton.focus();
      await page.keyboard.press(saveShortcut);

      await expect
        .poll(() => savePayloads.length, { timeout: 10000 })
        .toBeGreaterThan(0);

      const payload = savePayloads.at(-1) as Record<string, unknown>;
      expect(String(payload.userId)).toBe("123456");
      expect(payload.ifMatchUpdatedAt).toBe(mockCardsRecord.updatedAt);

      const cards = payload.cards as Array<Record<string, unknown>>;
      expect(Array.isArray(cards)).toBe(true);
      expect(cards).toHaveLength(1);
      expectSavedTogglePayload(cards[0]);
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
      await waitForUserEditorReady(page);
      await waitForCleanEditorState(page);
    });

    await test.step("Toggle a card and then discard changes", async () => {
      const targetToggle = await getPrimaryEditorCardToggle(page);
      const saveButton = page.getByRole("button", { name: /save changes/i });
      const discardButton = page.getByRole("button", {
        name: /discard unsaved changes/i,
      });
      const discardDialog = page.getByRole("alertdialog");

      await clickEditorToggle(targetToggle.toggle);
      await waitForDirtyEditorState(page);
      await discardButton.click();
      await expect(discardDialog).toBeVisible();
      await discardDialog
        .getByRole("button", { name: /discard changes/i })
        .click();

      await expect(page.getByText(/discarded changes/i)).toBeVisible();
      await expect(saveButton).toBeDisabled();
      await expect(discardButton).toBeDisabled();
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
      await waitForUserEditorReady(page);
      await waitForCleanEditorState(page);

      const targetToggle = await getPrimaryEditorCardToggle(page);

      await clickEditorToggle(targetToggle.toggle);
      await expect
        .poll(async () => targetToggle.toggle.getAttribute("aria-checked"), {
          timeout: 15000,
        })
        .toBe(targetToggle.initialChecked === "true" ? "false" : "true");
      await waitForPendingSaveState(page);
    });

    await test.step("Autosave should hit a save conflict and surface recovery UI", async () => {
      const saveButton = page.getByRole("button", { name: /save changes/i });

      await expect.poll(() => savePayloads.length, { timeout: 5000 }).toBe(1);

      expect(savePayloads[0]?.ifMatchUpdatedAt).toBe(mockCardsRecord.updatedAt);

      const conflictedCards = savePayloads[0]?.cards as Array<
        Record<string, unknown>
      >;
      expect(Array.isArray(conflictedCards)).toBe(true);
      expect(conflictedCards).toHaveLength(1);
      expectSavedTogglePayload(conflictedCards[0]);

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
      expectSavedTogglePayload(recoveredCards[0]);

      await expect(
        page.getByRole("button", { name: /reload & keep edits/i }),
      ).toHaveCount(0);
      await expect(page.getByText(/Auto-save in/i)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /save changes/i }),
      ).toBeDisabled();
    });
  });

  test("load restores a fresh local draft automatically and re-saves it", async ({
    page,
  }) => {
    const savePayloads: Array<Record<string, unknown>> = [];

    await page.addInitScript((userId: string) => {
      const key = `anicards:user-page-editor:draft:v1:${userId}`;
      globalThis.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          userId,
          savedAt: Date.now(),
          patch: {
            cardConfigs: {
              animeStats: {
                cardId: "animeStats",
                enabled: false,
                variant: "default",
                colorOverride: {
                  useCustomSettings: false,
                },
                advancedSettings: {},
              },
            },
          },
        }),
      );
    }, String(mockCardsRecord.userId));

    await test.step("Mock user, cards, preview, and save endpoints", async () => {
      await mockSuccessfulApiRoutes(page, {
        storeCards: async (route) => {
          const postData = route.request().postData();
          savePayloads.push(postData ? JSON.parse(postData) : {});

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              userId: mockCardsRecord.userId,
              updatedAt: "2025-01-02T00:00:00.000Z",
            }),
          });
        },
      });
    });

    await test.step("Load the user editor with a recoverable local draft", async () => {
      await gotoReady(page, "/user/TestUser");
      await expect(
        page.getByRole("heading", { name: "Your Cards" }),
      ).toBeVisible();
      await waitForUserEditorReady(page);
    });

    await test.step("The draft should auto-apply and save without user intervention", async () => {
      await expect.poll(() => savePayloads.length, { timeout: 6000 }).toBe(1);

      const payload = savePayloads[0] ?? {};
      expect(payload.ifMatchUpdatedAt).toBe(mockCardsRecord.updatedAt);

      const cards = payload.cards as Array<Record<string, unknown>>;
      expect(Array.isArray(cards)).toBe(true);
      expect(cards).toHaveLength(1);
      expectSavedTogglePayload(cards[0]);

      await expect(page.getByText(/draft found:/i)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /save changes/i }),
      ).toBeDisabled();
    });
  });

  if (isRealHandlerRunEnabled()) {
    test("@real-handlers persists editor changes through the real bootstrap and save handlers", async ({
      page,
    }) => {
      const missingEnvKeys = getMissingRealHandlerEnvKeys();

      if (missingEnvKeys.length > 0) {
        throw new Error(
          `Real-handler user/editor coverage requires: ${missingEnvKeys.join(
            ", ",
          )}`,
        );
      }

      test.slow();

      const uniqueSeed = `${Date.now()}${test.info().workerIndex}${realHandlerSeedCounter++}`;
      const userId = Number(uniqueSeed.slice(-9));
      const username = `PlaywrightRealUser${userId}`;
      const seededCards = structuredClone(mockCardsRecord.cards);

      await test.step("Seed a real stored user and card snapshot from the browser context", async () => {
        await gotoReady(page, "/");

        const storeUserResponse = await fetchBrowserJson(
          page,
          "/api/store-users",
          {
            method: "POST",
            body: {
              userId,
              username,
              stats: mockUserStatsData,
            },
          },
        );
        expectSuccessfulBrowserResponse(
          storeUserResponse,
          "Seeding /api/store-users",
        );

        const storeCardsResponse = await fetchBrowserJson(
          page,
          "/api/store-cards",
          {
            method: "POST",
            body: {
              userId,
              cards: seededCards,
            },
          },
        );
        expectSuccessfulBrowserResponse(
          storeCardsResponse,
          "Seeding /api/store-cards",
        );
      });

      let targetCardId = "";
      let expectedSavedState: "true" | "false" = "false";

      await test.step("Load the real user editor and make a persistent change", async () => {
        await gotoReady(page, `/user/${username}`);
        await expect(
          page.getByRole("heading", { name: /your cards/i }),
        ).toBeVisible({ timeout: 15000 });
        await waitForUserEditorReady(page);
        await waitForCleanEditorState(page);

        const targetToggle = await getPrimaryEditorCardToggle(page);
        targetCardId = targetToggle.cardId;
        expectedSavedState =
          targetToggle.initialChecked === "true" ? "false" : "true";

        await clickEditorToggle(targetToggle.toggle);
        await waitForDirtyEditorState(page);

        await page.getByRole("button", { name: /save changes/i }).click();

        await expect(
          page.getByRole("button", { name: /save changes/i }),
        ).toBeDisabled({ timeout: 15000 });
        await expect(
          page.getByRole("button", { name: /discard unsaved changes/i }),
        ).toBeDisabled({ timeout: 15000 });
      });

      await test.step("Reloading the page should read the saved toggle state from the real handlers", async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(
          page.getByRole("heading", { name: /your cards/i }),
        ).toBeVisible({ timeout: 15000 });
        await waitForUserEditorReady(page);

        const reloadedToggle = page
          .getByTestId(`card-tile-${targetCardId}`)
          .getByRole("switch")
          .first();

        await expect(reloadedToggle).toHaveAttribute(
          "aria-checked",
          expectedSavedState,
          { timeout: 15000 },
        );
      });
    });
  }
});
