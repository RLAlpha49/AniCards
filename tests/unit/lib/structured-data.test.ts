import { describe, expect, it } from "bun:test";

import { resolveSiteUrl, SITE_NAME } from "@/lib/site-config";
import {
  generateSiteStructuredData,
  generateStructuredData,
} from "@/lib/structured-data";

describe("structured data helpers", () => {
  it("emits site-level founder, organization, and website entities", () => {
    const entries = generateSiteStructuredData();

    expect(entries.map((entry) => entry["@type"])).toEqual([
      "Person",
      "Organization",
      "WebSite",
    ]);
  });

  it("adds a SearchAction to the website entity for username lookups", () => {
    const entries = generateSiteStructuredData();
    const webSiteEntry = entries.find(
      (entry) => entry["@type"] === "WebSite",
    ) as {
      potentialAction: {
        "@type": string;
        target: {
          "@type": string;
          urlTemplate: string;
        };
        "query-input": string;
      };
    };

    expect(webSiteEntry.potentialAction).toEqual({
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${resolveSiteUrl("/user")}?username={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    });
  });

  it("models the projects route as a collection page with a concrete item list", () => {
    const entries = generateStructuredData("projects");
    const types = entries.map((entry) => entry["@type"]);
    const itemList = entries.find((entry) => entry["@type"] === "ItemList") as {
      numberOfItems: number;
      itemListElement: Array<{
        item: {
          name: string;
        };
      }>;
    };

    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(itemList.numberOfItems).toBe(3);
    expect(itemList.itemListElement[0]?.item.name).toBe("AniCards");
  });

  it("uses route-aware contact schema instead of a generic webpage", () => {
    const entries = generateStructuredData("contact");

    expect(entries[0]?.["@type"]).toBe("ContactPage");
  });

  it("models the privacy route as a standard public webpage disclosure", () => {
    const entries = generateStructuredData("privacy");

    expect(entries[0]?.["@type"]).toBe("WebPage");
  });

  it("adds breadcrumb structured data for static routes", () => {
    const entries = generateStructuredData("search");
    const webPageEntry = entries.find(
      (entry) => entry["@type"] === "WebPage",
    ) as {
      breadcrumb?: {
        "@id": string;
      };
    };
    const breadcrumbEntry = entries.find(
      (entry) => entry["@type"] === "BreadcrumbList",
    ) as {
      "@id": string;
      itemListElement: Array<{
        name: string;
        item: string;
      }>;
    };

    expect(webPageEntry.breadcrumb?.["@id"]).toBe(
      `${resolveSiteUrl("/search")}#breadcrumb`,
    );
    expect(
      breadcrumbEntry.itemListElement.map(({ item, name }) => ({ item, name })),
    ).toEqual([
      {
        name: SITE_NAME,
        item: resolveSiteUrl("/"),
      },
      {
        name: "Search",
        item: resolveSiteUrl("/search"),
      },
    ]);
  });

  it("builds breadcrumb trails from the canonical user profile route", () => {
    const entries = generateStructuredData("user", {
      canonical: "/user/Alpha49",
      description: "Profile stats for Alpha49.",
      keywords: ["alpha49", "anilist"],
      title: "Alpha49's AniList Stats - AniCards",
    });
    const breadcrumbEntry = entries.find(
      (entry) => entry["@type"] === "BreadcrumbList",
    ) as {
      itemListElement: Array<{
        name: string;
        item: string;
      }>;
    };

    expect(
      breadcrumbEntry.itemListElement.map(({ item, name }) => ({ item, name })),
    ).toEqual([
      {
        name: SITE_NAME,
        item: resolveSiteUrl("/"),
      },
      {
        name: "User",
        item: resolveSiteUrl("/user"),
      },
      {
        name: "Alpha49",
        item: resolveSiteUrl("/user/Alpha49"),
      },
    ]);
  });
});
