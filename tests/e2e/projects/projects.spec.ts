import { test, expect } from "@playwright/test";

const PROJECTS = [
  {
    name: "AniList Custom List Manager",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
  },
  {
    name: "Kenmei to AniList",
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
        const quickLink = page.getByRole("link", {
          name: new RegExp(`View on GitHub for ${project.name}`, "i"),
        });
        await expect(quickLink).toHaveAttribute("href", project.url);
        await expect(quickLink).toHaveAttribute("target", "_blank");
        await expect(quickLink).toHaveAttribute("rel", /noopener/i);
      }
    });

    await test.step("Profile CTA and generator navigation", async () => {
      const profileLink = page.getByRole("link", { name: /visit my github/i });
      await expect(profileLink).toHaveAttribute(
        "href",
        "https://github.com/RLAlpha49",
      );
      await expect(profileLink).toHaveAttribute("target", "_blank");
      await expect(profileLink).toHaveAttribute("rel", /noopener/i);

      const generatorLink = page.getByRole("link", {
        name: /open the generator/i,
      });
      await expect(generatorLink).toHaveAttribute("href", "/generator");
    });

    await test.step("Route list jumps to an entry", async () => {
      const route = page.getByRole("link", {
        name: /my custom lists need sorting/i,
      });
      await route.click();
      await expect(page).toHaveURL(/#custom-list-manager$/);
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: /anilist custom list manager/i,
        }),
      ).toBeInViewport();
    });
  });
});
