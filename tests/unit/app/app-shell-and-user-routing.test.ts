import { describe, expect, it } from "bun:test";
import type { NextRequest } from "next/server";
import { isValidElement, type ReactNode } from "react";

import robots from "@/app/robots";
import { generateMetadata as generateProfileUserMetadata } from "@/app/user/[username]/page";
import LookupUserPage, {
  buildLegacyUserRedirectUrl,
  generateMetadata as generateLookupUserMetadata,
} from "@/app/user/page";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { REQUEST_PROOF_COOKIE_NAME } from "@/lib/api/request-proof";
import { siteMetadata as rootMetadata } from "@/lib/seo";
import { getSiteUrl, resolveSiteUrl } from "@/lib/site-config";
import { config as middlewareConfig, proxy } from "@/proxy";

function treeContainsElementType(
  node: ReactNode,
  elementType: unknown,
): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => treeContainsElementType(child, elementType));
  }

  if (!isValidElement(node)) {
    return false;
  }

  if (node.type === elementType) {
    return true;
  }

  return treeContainsElementType(node.props.children, elementType);
}

describe("App shell server coverage", () => {
  it("injects CSP, nonce headers, and a request proof cookie for HTML routes", async () => {
    const request = new Request("http://localhost/search", {
      headers: {
        "user-agent": "bun-test",
        "x-vercel-forwarded-for": "127.0.0.1",
      },
    }) as unknown as NextRequest;

    const response = await proxy(request);
    const nonce = response.headers.get("x-nonce");
    const cspHeader = response.headers.get("content-security-policy");
    const setCookieHeader = response.headers.get("set-cookie");
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
    expect(setCookieHeader).toContain(`${REQUEST_PROOF_COOKIE_NAME}=`);
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toMatch(/SameSite=strict/i);
  });

  it("covers API routes in the proxy matcher so request IDs are injected consistently", () => {
    expect(middlewareConfig.matcher).toContain(
      "/((?!_next/static|_next/image|favicon.ico|icon.ico|icon.svg).*)",
    );
  });

  it("advertises the favicon assets in root metadata", () => {
    expect(rootMetadata.icons).toMatchObject({
      icon: [
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
        {
          url: "/icon.ico",
          sizes: "any",
        },
      ],
    });
  });

  it("injects request IDs for API routes without adding HTML-only CSP headers", async () => {
    const request = new Request("http://localhost/api/error-reports", {
      method: "POST",
      headers: {
        origin: "http://localhost",
      },
    }) as unknown as NextRequest;

    const response = await proxy(request);

    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("x-nonce")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
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
        customFilter: "all",
      }),
    ).toBe("/user/Alpha49?q=seasonal+favorites");

    expect(
      buildLegacyUserRedirectUrl({
        username: "Alpha49",
        visibility: "private",
        group: "Top 10",
        customFilter: "customized",
      }),
    ).toBe(
      "/user/Alpha49?visibility=private&group=Top+10&customFilter=customized",
    );
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

  it("omits page-level JSON-LD for lookup-only /user routes", async () => {
    const page = await LookupUserPage({
      searchParams: Promise.resolve({ userId: "123456" }),
    });

    expect(treeContainsElementType(page, StructuredDataScript)).toBe(false);
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
