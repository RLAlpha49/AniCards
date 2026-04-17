import { describe, expect, it } from "bun:test";
import type { Metadata } from "next";

import {
  buildCanonicalUserPageUrl,
  buildUserLookupPath,
  buildUserSocialPreviewImage,
  generateMetadata,
  getDefaultSocialPreviewImage,
  getSearchLookupMode,
  getSearchPagePath,
  getSearchPagePrefillQuery,
  getSearchPageSEOConfig,
  getStaticPageSocialPreviewImage,
  getUserPageSEOConfig,
  normalizeSearchLookupInput,
  seoConfigs,
} from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-config";

function getTwitterMetadata(metadata: Metadata) {
  return metadata.twitter as { card?: string; images?: string[] } | undefined;
}

function getOpenGraphMetadata(metadata: Metadata) {
  return metadata.openGraph as
    | { images?: string[]; type?: string; url?: string }
    | undefined;
}

function getRobotsMetadata(metadata: Metadata) {
  return metadata.robots as { index?: boolean } | undefined;
}

describe("SEO metadata helpers", () => {
  it("emits raster-compatible Open Graph and Twitter preview images for static pages", () => {
    const metadata = generateMetadata(seoConfigs.home);
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const previewImage = getDefaultSocialPreviewImage();

    expect(previewImage).toContain("/card.png?");
    expect(previewImage).not.toContain("/card.svg");
    expect(openGraph?.images).toEqual([previewImage]);
    expect(twitter?.card).toBe("summary_large_image");
    expect(twitter?.images).toEqual([previewImage]);
    expect(openGraph?.url).toBe(resolveSiteUrl("/"));
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("uses the canonical public profile path and preview image for username routes", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        username: "Alpha49",
        routeType: "profile",
      }),
    );
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const previewImage = buildUserSocialPreviewImage({ username: "Alpha49" });

    if (!previewImage) {
      throw new Error("Expected a username preview image");
    }

    expect(previewImage).toContain("/card.png?");
    expect(metadata.alternates?.canonical).toBe("/user/Alpha49");
    expect(openGraph?.url).toBe(resolveSiteUrl("/user/Alpha49"));
    expect(openGraph?.type).toBe("profile");
    expect(twitter?.images).toEqual([previewImage]);
  });

  it("emits a lookup Open Graph URL without inventing a canonical URL for noindex userId pages", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        routeType: "lookup",
        userId: "123456",
      }),
    );
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const robots = getRobotsMetadata(metadata);
    const previewImage = buildUserSocialPreviewImage({ userId: "123456" });

    if (!previewImage) {
      throw new Error("Expected a user ID preview image");
    }

    expect(metadata.alternates).toBeUndefined();
    expect(robots?.index).toBe(false);
    expect(previewImage).toContain("/card.png?");
    expect(openGraph?.url).toBe(resolveSiteUrl("/user?userId=123456"));
    expect(twitter?.images).toEqual([previewImage]);
  });

  it("keeps the legacy /user lookup surface non-canonical until a username is known", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        routeType: "lookup",
      }),
    );

    expect(metadata.alternates).toBeUndefined();
    expect(getRobotsMetadata(metadata)?.index).toBe(false);
  });

  it("marks custom-filtered user views as noindex and preserves the filter in lookup URLs", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        routeType: "lookup",
        username: "Alpha49",
        customFilter: "customized",
      }),
    );
    const openGraph = getOpenGraphMetadata(metadata);
    const robots = getRobotsMetadata(metadata);

    expect(robots?.index).toBe(false);
    expect(openGraph?.url).toBe(
      resolveSiteUrl("/user?username=Alpha49&customFilter=customized"),
    );
  });

  it("falls back openGraph.url to the site root when no canonical or explicit OG URL is provided", () => {
    const metadata = generateMetadata({
      title: "Custom SEO Test",
      description: "Ensures openGraph.url is always emitted.",
    });
    const openGraph = getOpenGraphMetadata(metadata);

    expect(metadata.alternates).toBeUndefined();
    expect(openGraph?.url).toBe(resolveSiteUrl("/"));
  });

  it("keeps /search canonical while describing both username and user ID discovery", () => {
    const metadata = generateMetadata(seoConfigs.search);
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const previewImage = getStaticPageSocialPreviewImage("search");

    expect(metadata.alternates?.canonical).toBe("/search");
    expect(metadata.description).toContain("username or numeric ID");
    expect(openGraph?.url).toBe(resolveSiteUrl("/search"));
    expect(openGraph?.images).toEqual([previewImage]);
    expect(twitter?.images).toEqual([previewImage]);
  });

  it("keeps the about page canonical and indexable", () => {
    const metadata = generateMetadata(seoConfigs.about);
    const openGraph = getOpenGraphMetadata(metadata);
    const robots = getRobotsMetadata(metadata);
    const previewImage = getStaticPageSocialPreviewImage("about");

    expect(metadata.alternates?.canonical).toBe("/about");
    expect(openGraph?.url).toBe(resolveSiteUrl("/about"));
    expect(openGraph?.images).toEqual([previewImage]);
    expect(robots?.index).toBe(true);
  });

  it("assigns distinct route-specific preview images to the static marketing pages", () => {
    const pageKeys = [
      "about",
      "contact",
      "examples",
      "privacy",
      "projects",
      "search",
    ] as const;
    const previewImages = pageKeys.map((pageKey) => {
      const metadata = generateMetadata(seoConfigs[pageKey]);
      const openGraph = getOpenGraphMetadata(metadata);
      const twitter = getTwitterMetadata(metadata);
      const previewImage = getStaticPageSocialPreviewImage(pageKey);

      expect(openGraph?.images).toEqual([previewImage]);
      expect(twitter?.images).toEqual([previewImage]);

      return previewImage;
    });

    expect(new Set(previewImages).size).toBe(previewImages.length);
    expect(previewImages).not.toContain(getDefaultSocialPreviewImage());
  });

  it("normalizes the public /search mode contract and omits the default mode when possible", () => {
    expect(getSearchLookupMode(" user-id ")).toBe("userId");
    expect(getSearchLookupMode("userid")).toBe("userId");
    expect(getSearchLookupMode("username")).toBe("username");

    expect(
      normalizeSearchLookupInput(
        "https://anilist.co/user/Alpha49/animelist",
        "username",
      ),
    ).toEqual({
      ok: true,
      mode: "username",
      query: "Alpha49",
    });
    expect(normalizeSearchLookupInput("@Alpha49", "username")).toEqual({
      ok: true,
      mode: "username",
      query: "Alpha49",
    });
    expect(normalizeSearchLookupInput("000542244", "username")).toEqual({
      ok: true,
      mode: "userId",
      query: "542244",
    });
    expect(
      normalizeSearchLookupInput(
        "www.anilist.co/user/000542244/#favorites",
        "username",
      ),
    ).toEqual({
      ok: true,
      mode: "userId",
      query: "542244",
    });
    expect(
      normalizeSearchLookupInput(
        "anilist.co/user/Alpha49?view=stats#overview",
        "username",
      ),
    ).toEqual({
      ok: true,
      mode: "username",
      query: "Alpha49",
    });
    expect(normalizeSearchLookupInput("54two24", "userId")).toEqual({
      ok: false,
      reason: "expectedUserId",
    });
    expect(
      normalizeSearchLookupInput(
        "https://example.com/user/Alpha49",
        "username",
      ),
    ).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(normalizeSearchLookupInput("/user/", "username")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(
      getSearchPagePrefillQuery(
        "https://anilist.co/user/Alpha49/animelist",
        "username",
      ),
    ).toBe("Alpha49");
    expect(getSearchPagePrefillQuery("000542244", "userId")).toBe("542244");

    expect(getSearchPagePath()).toBe("/search");
    expect(getSearchPagePath({ mode: "userId" })).toBe("/search?mode=userId");
    expect(
      getSearchPagePath({
        mode: "username",
        query: "Alpha49",
        includeDefaultMode: true,
      }),
    ).toBe("/search?mode=username&query=Alpha49");
  });

  it("keeps canonical and compatibility user URLs on the shared URL policy layer", () => {
    expect(
      buildCanonicalUserPageUrl({
        username: " Alpha49 ",
        q: " seasonal favorites ",
        visibility: "all",
        group: "All",
        customFilter: "all",
      }),
    ).toBe("/user/Alpha49?q=seasonal+favorites");

    expect(
      buildCanonicalUserPageUrl({
        username: "Alpha49",
        visibility: "private",
        group: "Top 10",
        customFilter: "customized",
      }),
    ).toBe(
      "/user/Alpha49?visibility=private&group=Top+10&customFilter=customized",
    );

    expect(
      buildUserLookupPath({
        userId: "542244",
        username: "Alpha49",
        q: "seasonal favorites",
      }),
    ).toBe("/user?userId=542244&username=Alpha49&q=seasonal+favorites");
  });

  it("keeps canonical /search while noindexing transient mode/query state", () => {
    const queryMetadata = generateMetadata(
      getSearchPageSEOConfig({ query: "@Alpha49" }),
    );
    const modeMetadata = generateMetadata(
      getSearchPageSEOConfig({ mode: "userId" }),
    );
    const defaultMetadata = generateMetadata(
      getSearchPageSEOConfig({ mode: "username" }),
    );

    expect(queryMetadata.alternates?.canonical).toBe("/search");
    expect(modeMetadata.alternates?.canonical).toBe("/search");
    expect(getRobotsMetadata(queryMetadata)?.index).toBe(false);
    expect(getRobotsMetadata(modeMetadata)?.index).toBe(false);
    expect(getRobotsMetadata(defaultMetadata)?.index).toBe(true);
  });

  it("keeps the privacy disclosure publicly canonical and indexable", () => {
    const metadata = generateMetadata(seoConfigs.privacy);
    const openGraph = getOpenGraphMetadata(metadata);
    const robots = getRobotsMetadata(metadata);
    const previewImage = getStaticPageSocialPreviewImage("privacy");

    expect(metadata.alternates?.canonical).toBe("/privacy");
    expect(openGraph?.url).toBe(resolveSiteUrl("/privacy"));
    expect(openGraph?.images).toEqual([previewImage]);
    expect(robots?.index).toBe(true);
  });
});
