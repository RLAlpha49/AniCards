import { beforeEach, describe, expect, it, mock } from "bun:test";

type PublicUserProfileSitemapEntry = {
  username: string;
  lastmod?: string;
};

const listPublicUserProfileSitemapEntriesMock = mock(
  async (): Promise<PublicUserProfileSitemapEntry[]> => [],
);

mock.module("@/lib/server/user-data", () => ({
  listPublicUserProfileSitemapEntries: listPublicUserProfileSitemapEntriesMock,
}));

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=600";
const SITEMAP_PATHS = [
  "/",
  "/search",
  "/examples",
  "/projects",
  "/about",
  "/privacy",
  "/contact",
];
const DEFAULT_BASE_URL = "https://anicards.alpha49.com";
const PROFILE_LASTMOD = "2026-03-27T00:00:05.000Z";

beforeEach(() => {
  listPublicUserProfileSitemapEntriesMock.mockReset();
  listPublicUserProfileSitemapEntriesMock.mockResolvedValue([]);
});

async function getSitemap(siteUrl?: string) {
  const envKey = "NEXT_PUBLIC_SITE_URL";
  const env = process.env as Record<string, string | undefined>;
  const previous = env[envKey];

  if (siteUrl === undefined) {
    delete env[envKey];
  } else {
    env[envKey] = siteUrl;
  }

  try {
    const modulePath = `../../../../app/sitemap.xml/route?cacheBust=${Date.now()}`;
    const { GET } = await import(modulePath);
    const response = await GET();
    const xml = await response.text();
    return { response, xml };
  } finally {
    if (previous === undefined) {
      delete env[envKey];
    } else {
      env[envKey] = previous;
    }
  }
}

describe("sitemap.xml route", () => {
  it("forces request-time rendering so builds do not require Redis-backed sitemap data", async () => {
    const modulePath = `../../../../app/sitemap.xml/route?cacheBust=${Date.now()}`;
    const { dynamic } = await import(modulePath);

    expect(dynamic).toBe("force-dynamic");
  });

  it("returns a cacheable XML sitemap with curated public routes, canonical profile entries, and only trustworthy lastmod timestamps", async () => {
    listPublicUserProfileSitemapEntriesMock.mockResolvedValue([
      { username: "Alpha49", lastmod: PROFILE_LASTMOD },
      { username: "Beta User" },
    ]);

    const { response, xml } = await getSitemap();

    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("Content-Type")).toBe("application/xml");

    SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${DEFAULT_BASE_URL}${path}`);
    });

    expect(xml).toContain(`<lastmod>${PROFILE_LASTMOD}</lastmod>`);
    expect(xml.match(/<lastmod>/g)?.length ?? 0).toBe(1);
    expect(xml).toContain(`${DEFAULT_BASE_URL}/user/Alpha49`);
    expect(xml).toContain(`${DEFAULT_BASE_URL}/user/Beta%20User`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/search?mode=userId`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/user?username=`);
  });

  it("uses NEXT_PUBLIC_SITE_URL when provided", async () => {
    const customBaseUrl = "https://custom.example";
    listPublicUserProfileSitemapEntriesMock.mockResolvedValue([
      { username: "Alpha49", lastmod: PROFILE_LASTMOD },
    ]);

    const { xml } = await getSitemap(customBaseUrl);

    SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${customBaseUrl}${path}`);
    });

    expect(xml).toContain(`${customBaseUrl}/user/Alpha49`);
  });
});
