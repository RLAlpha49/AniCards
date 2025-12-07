import { test, expect } from "@playwright/test";

const PROJECTS = [
  {
    name: "Anilist Custom List Manager",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
  },
  {
    name: "Kenmai to Anilist",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
  },
];

test.describe("Projects page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await expect(
      page.getByRole("heading", { level: 1, name: /projects/i }),
    ).toBeVisible();
  });

  test("exposes GitHub links and profile CTA", async ({ page }) => {
    await test.step("Render project cards", async () => {
      for (const project of PROJECTS) {
        await expect(
          page.getByRole("heading", { name: new RegExp(project.name, "i") }),
        ).toBeVisible();
      }
    });

    await test.step("Validate GitHub links", async () => {
      const viewButtons = page.getByRole("link", { name: /view on github/i });
      await expect(viewButtons).toHaveCount(PROJECTS.length);

      for (const project of PROJECTS) {
        const quickLink = page.getByLabel(
          new RegExp(`View ${project.name} on GitHub`, "i"),
        );
        await expect(quickLink).toHaveAttribute("href", project.url);
        await expect(quickLink).toHaveAttribute("target", "_blank");
        await expect(quickLink).toHaveAttribute("rel", /noopener/i);
      }
    });

    await test.step("Profile CTA and home navigation", async () => {
      const profileLink = page.getByRole("link", { name: /visit my github/i });
      await expect(profileLink).toHaveAttribute(
        "href",
        "https://github.com/RLAlpha49",
      );
      await expect(profileLink).toHaveAttribute("target", "_blank");
      await expect(profileLink).toHaveAttribute("rel", /noopener/i);

      const homeLink = page.getByRole("link", { name: /back to home/i });
      await homeLink.click();
      await expect(page).toHaveURL(/\/$/);
    });
  });
});
