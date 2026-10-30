import { expect, type Page } from "@playwright/test";

/** Steps the generator exposes, in rail order. @source */
const STEPS = ["Username", "Palette", "Cards", "Finish"] as const;
export type StepName = (typeof STEPS)[number];

/**
 * Page object for the generator at `/generator`.
 *
 * The generator is a single page with a step rail rather than a modal wizard,
 * so these helpers navigate the rail and never open or dismiss a dialog. Error
 * handling still uses a dialog, because a failed generation reports through one.
 * @source
 */
export class GeneratorPage {
  constructor(private readonly page: Page) {}

  /** Opens the generator route directly. */
  async goto() {
    await this.page.goto("/generator");
    await expect(this.getStepHeading("Username")).toBeVisible();
  }

  /**
   * Opens the generator from whichever page is current.
   *
   * The home and examples pages link here, so this follows the first call to
   * action rather than expecting a dialog.
   */
  async openGenerator() {
    await this.page
      .getByRole("button", {
        name: /create your card|open the generator|create your cards|create this card/i,
      })
      .first()
      .click();
    // Client-side routing has no load event, so the URL is polled instead.
    await expect.poll(() => this.page.url()).toContain("/generator");
    await this.waitForGeneratorOpen();
  }

  /** Waits until the generator has rendered its first step. */
  async waitForGeneratorOpen() {
    await expect(this.getStepHeading("Username")).toBeVisible({
      timeout: 15000,
    });
  }

  /** The step panel, used when a test needs a scoped container. */
  getDialog() {
    return this.page.locator("main");
  }

  /** The username field on the Username step. */
  getUsernameInput() {
    return this.page.getByRole("textbox", { name: /anilist username/i });
  }

  /** Types a username and asserts the field took it. */
  async enterUsername(username: string) {
    const input = this.getUsernameInput();
    await input.fill(username);
    await expect(input).toHaveValue(username);
  }

  /** Heading of a step, once that step is on screen. */
  getStepHeading(step: StepName) {
    const titles: Record<StepName, RegExp> = {
      Username: /whose stats/i,
      Palette: /^colours$/i,
      Cards: /choose your cards/i,
      Finish: /final details/i,
    };
    return this.page.getByRole("heading", { name: titles[step], level: 2 });
  }

  /**
   * Moves to a step using the rail button.
   *
   * @param step - Step label shown in the rail.
   */
  async goToStep(step: StepName) {
    // The rail is a drawer on narrow screens, so open it when its trigger is up.
    const trigger = this.page.getByRole("button", { name: /^steps/i });
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
    }

    await this.page
      .getByRole("navigation", { name: /generator steps/i })
      .getByRole("button", { name: new RegExp(`^${step}`, "i") })
      .click();

    await expect(this.getStepHeading(step)).toBeVisible();
  }

  /** Moves to the next step with the action row. */
  async clickContinue() {
    await this.page.getByRole("button", { name: /next step/i }).click();
  }

  /** Moves back one step with the action row. */
  async clickBack() {
    await this.page.getByRole("button", { name: /back a step/i }).click();
  }

  /**
   * Adds or removes a card by its catalogue title.
   *
   * Every row carries a button labelled "Add <title>" or "Remove <title>", so
   * the row is reachable without depending on layout.
   *
   * @param title - Card title, for example "Anime Statistics".
   */
  async selectCardType(title: string) {
    const add = this.page.getByRole("button", {
      name: new RegExp(`^add ${title}$`, "i"),
    });
    if (await add.count()) {
      await add.first().click();
      return;
    }
    await this.page
      .getByRole("button", { name: new RegExp(`^remove ${title}$`, "i") })
      .first()
      .click();
  }

  /** Reads how many cards the generator reports as selected. */
  async getSelectedCardsCount(): Promise<number> {
    const counter = this.page
      .getByRole("button", { name: /^generate \d+ cards?$/i })
      .first();
    const label = (await counter.getAttribute("aria-label")) ?? "";
    const match = /\d+/.exec(label);
    return match ? Number.parseInt(match[0], 10) : 0;
  }

  /** Clicks the generate action. */
  async clickGenerate() {
    await this.page
      .getByRole("button", { name: /^generate \d+ cards?$/i })
      .click();
  }

  /** Waits for the generating overlay to clear after a generation. */
  async waitForLoadingComplete() {
    await expect(this.page.getByRole("status").first()).not.toBeVisible({
      timeout: 40000,
    });
  }

  /** A row in the preview panel, used to assert what is being previewed. */
  getPreviewCaption() {
    return this.page.locator("aside").getByText(/^preview$/i);
  }

  /** Closes the error dialog raised by a failed generation. */
  async closeErrorPopup() {
    const dialog = this.page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^close$/i }).click();
  }

  /** Presses a key on the page. */
  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }
}
