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
const STATIC_SITEMAP_PATHS = [
  "/",
  "/search",
  "/examples",
  "/examples/gallery",
  "/examples/core-stats",
  "/examples/anime-deep-dive",
  "/examples/manga-deep-dive",
  "/examples/activity-engagement",
  "/examples/library-progress",
  "/examples/advanced-analytics",
  "/projects",
  "/about",
  "/privacy",
  "/contact",
];
const SITEMAP_SHARD_PATHS = ["/sitemap-static.xml", "/sitemap-profiles.xml"];
const DEFAULT_BASE_URL = "https://anicards.alpha49.com";
const PROFILE_LASTMOD = "2026-03-27T00:00:05.000Z";
const STATIC_LASTMOD = "2026-04-20";

beforeEach(() => {
  listPublicUserProfileSitemapEntriesMock.mockReset();
  listPublicUserProfileSitemapEntriesMock.mockResolvedValue([]);
});

async function getRouteXml(modulePath: string, siteUrl?: string) {
  const envKey = "NEXT_PUBLIC_SITE_URL";
  const env = process.env as Record<string, string | undefined>;
  const previous = env[envKey];

  if (siteUrl === undefined) {
    delete env[envKey];
  } else {
    env[envKey] = siteUrl;
  }

  try {
    const { GET } = await import(`${modulePath}?cacheBust=${Date.now()}`);
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
    const rootModulePath = `../../../../app/sitemap.xml/route`;
    const staticModulePath = `../../../../app/sitemap-static.xml/route`;
    const profilesModulePath = `../../../../app/sitemap-profiles.xml/route`;
    const [
      { dynamic: rootDynamic },
      { dynamic: staticDynamic },
      { dynamic: profilesDynamic },
    ] = await Promise.all([
      import(`${rootModulePath}?cacheBust=${Date.now()}`),
      import(`${staticModulePath}?cacheBust=${Date.now()}`),
      import(`${profilesModulePath}?cacheBust=${Date.now()}`),
    ]);

    expect(rootDynamic).toBe("force-dynamic");
    expect(staticDynamic).toBe("force-dynamic");
    expect(profilesDynamic).toBe("force-dynamic");
  });

  it("returns a cacheable sitemap index that points crawlers at the static and profile shards", async () => {
    listPublicUserProfileSitemapEntriesMock.mockResolvedValue([
      { username: "Alpha49", lastmod: PROFILE_LASTMOD },
      { username: "Beta User" },
    ]);

    const { response, xml } = await getRouteXml(
      `../../../../app/sitemap.xml/route`,
    );

    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("Content-Type")).toBe("application/xml");

    SITEMAP_SHARD_PATHS.forEach((path) => {
      expect(xml).toContain(`${DEFAULT_BASE_URL}${path}`);
    });

    expect(xml).toContain(`<lastmod>${STATIC_LASTMOD}</lastmod>`);
    expect(xml).toContain(`<lastmod>${PROFILE_LASTMOD}</lastmod>`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/user/Alpha49`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/examples/gallery?search=`);
  });

  it("returns a cacheable static sitemap shard with clean examples routes and lastmod hints", async () => {
    const { response, xml } = await getRouteXml(
      `../../../../app/sitemap-static.xml/route`,
    );

    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("Content-Type")).toBe("application/xml");

    STATIC_SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${DEFAULT_BASE_URL}${path}`);
    });

    expect(xml.match(/<lastmod>/g)?.length ?? 0).toBe(
      STATIC_SITEMAP_PATHS.length,
    );
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/search?mode=userId`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/examples?search=`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/examples?category=`);
  });

  it("returns a cacheable profile sitemap shard with only trustworthy profile lastmod timestamps", async () => {
    listPublicUserProfileSitemapEntriesMock.mockResolvedValue([
      { username: "Alpha49", lastmod: PROFILE_LASTMOD },
      { username: "Beta User" },
    ]);

    const { response, xml } = await getRouteXml(
      `../../../../app/sitemap-profiles.xml/route`,
    );

    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("Content-Type")).toBe("application/xml");

    expect(xml).toContain(`${DEFAULT_BASE_URL}/user/Alpha49`);
    expect(xml).toContain(`${DEFAULT_BASE_URL}/user/Beta%20User`);
    expect(xml).toContain(`<lastmod>${PROFILE_LASTMOD}</lastmod>`);
    expect(xml.match(/<lastmod>/g)?.length ?? 0).toBe(1);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/sitemap-static.xml`);
    expect(xml).not.toContain(`${DEFAULT_BASE_URL}/user?username=`);
  });

  it("uses NEXT_PUBLIC_SITE_URL when provided across the sitemap index and shards", async () => {
    const customBaseUrl = "https://custom.example";
    listPublicUserProfileSitemapEntriesMock.mockResolvedValue([
      { username: "Alpha49", lastmod: PROFILE_LASTMOD },
    ]);

    const { xml: indexXml } = await getRouteXml(
      `../../../../app/sitemap.xml/route`,
      customBaseUrl,
    );
    const { xml: staticXml } = await getRouteXml(
      `../../../../app/sitemap-static.xml/route`,
      customBaseUrl,
    );
    const { xml: profilesXml } = await getRouteXml(
      `../../../../app/sitemap-profiles.xml/route`,
      customBaseUrl,
    );

    SITEMAP_SHARD_PATHS.forEach((path) => {
      expect(indexXml).toContain(`${customBaseUrl}${path}`);
    });

    STATIC_SITEMAP_PATHS.forEach((path) => {
      expect(staticXml).toContain(`${customBaseUrl}${path}`);
    });

    expect(profilesXml).toContain(`${customBaseUrl}/user/Alpha49`);
  });
});
