import { describe, expect, it } from "bun:test";
import type { NextRequest } from "next/server";

import robots from "@/app/robots";
import { generateMetadata as generateProfileUserMetadata } from "@/app/user/[username]/page";
import {
  buildLegacyUserRedirectUrl,
  generateMetadata as generateLookupUserMetadata,
} from "@/app/user/page";
import { getSiteUrl, resolveSiteUrl } from "@/lib/site-config";
import { config as middlewareConfig, proxy } from "@/proxy";

describe("App shell server coverage", () => {
  it("injects CSP and nonce headers for HTML routes", () => {
    const request = new Request("http://localhost/search", {
      headers: {
        "user-agent": "bun-test",
      },
    }) as unknown as NextRequest;

    const response = proxy(request);
    const nonce = response.headers.get("x-nonce");
    const cspHeader = response.headers.get("content-security-policy");
    const imgSrcDirective = cspHeader
      ?.split("; ")
      .find((directive) => directive.startsWith("img-src "));

    expect(nonce).toBeTruthy();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(cspHeader).toBeTruthy();
    expect(cspHeader).toContain(`'nonce-${nonce}'`);
    expect(cspHeader).toContain("script-src 'self'");
    expect(imgSrcDirective).toBeTruthy();
    expect(cspHeader).toContain("object-src 'none'");
    expect(imgSrcDirective).not.toMatch(/\shttps:(?=[\s;]|$)/);
  });

  it("keeps API routes outside the middleware matcher", () => {
    expect(middlewareConfig.matcher).toContain(
      "/((?!api|_next/static|_next/image|favicon.ico).*)",
    );
  });

  it("returns robots metadata that blocks API indexing and advertises the sitemap", () => {
    expect(robots()).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: ["/api/"],
        },
      ],
      sitemap: `${getSiteUrl()}/sitemap.xml`,
      host: getSiteUrl(),
    });
  });
});

describe("User route metadata and redirect helpers", () => {
  it("builds canonical legacy redirects without carrying default filters", () => {
    expect(
      buildLegacyUserRedirectUrl({
        username: " Alpha49 ",
        q: " seasonal favorites ",
        visibility: "all",
        group: "All",
      }),
    ).toBe("/user/Alpha49?q=seasonal+favorites");

    expect(
      buildLegacyUserRedirectUrl({
        username: "Alpha49",
        visibility: "private",
        group: "Top 10",
      }),
    ).toBe("/user/Alpha49?visibility=private&group=Top+10");
  });

  it("marks lookup metadata as noindex without inventing a canonical path for userId lookups", async () => {
    const metadata = await generateLookupUserMetadata({
      searchParams: Promise.resolve({ userId: "123456" }),
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
    expect(metadata.openGraph).toMatchObject({
      type: "profile",
    });
  });

  it("builds canonical profile metadata for username routes", async () => {
    const metadata = await generateProfileUserMetadata({
      params: Promise.resolve({ username: "Alpha49" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe("/user/Alpha49");
    expect(metadata.openGraph).toMatchObject({
      type: "profile",
      url: resolveSiteUrl("/user/Alpha49"),
    });
  });
});
