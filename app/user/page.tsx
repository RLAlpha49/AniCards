import "driver.js/dist/driver.css";
import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import PageShell from "@/components/PageShell";
import { UserPageEditor } from "@/components/user/UserPageEditor";
import { UserPageLoadingSpinner } from "@/components/user/UserPageLoading";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  generateMetadata as createMetadata,
  getUserPageSEOConfig,
  getUserProfilePath,
} from "@/lib/seo";

import LoadingPreview from "./loading";

/**
 * Forces Next.js to render this route on each request so user data stays fresh.
 * @source
 */
export const dynamic = "force-dynamic";

export function buildLegacyUserRedirectUrl(params: {
  username: string;
  q?: string;
  visibility?: string;
  group?: string;
  customFilter?: string;
}): string {
  const nextSearchParams = new URLSearchParams();

  if (params.q?.trim()) {
    nextSearchParams.set("q", params.q.trim());
  }

  if (params.visibility?.trim() && params.visibility !== "all") {
    nextSearchParams.set("visibility", params.visibility.trim());
  }

  if (params.group?.trim() && params.group !== "All") {
    nextSearchParams.set("group", params.group.trim());
  }

  if (params.customFilter?.trim() && params.customFilter !== "all") {
    nextSearchParams.set("customFilter", params.customFilter.trim());
  }

  const pathname = getUserProfilePath(params.username);
  const search = nextSearchParams.toString();

  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Builds metadata for the user page from resolved search parameters.
 * @param searchParams - Promise that yields optional AniList query parameters.
 * @returns Metadata tailored to the requested user profile.
 * @source
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    userId?: string;
    username?: string;
    q?: string;
    visibility?: string;
    group?: string;
    customFilter?: string;
  }>;
}): Promise<Metadata> {
  const params = await searchParams;

  return createMetadata(
    getUserPageSEOConfig({
      username: params.username,
      userId: params.userId,
      q: params.q,
      visibility: params.visibility,
      group: params.group,
      customFilter: params.customFilter,
      routeType: "lookup",
    }),
  );
}

/**
 * Wraps the client-side user page in a suspense boundary with a spinner fallback.
 * @source
 */
export default async function UserPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    userId?: string;
    username?: string;
    q?: string;
    visibility?: string;
    group?: string;
    customFilter?: string;
  }>;
}>) {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const params = await searchParams;

  if (!params.userId && params.username?.trim()) {
    redirect(
      buildLegacyUserRedirectUrl({
        username: params.username,
        q: params.q,
        visibility: params.visibility,
        group: params.group,
        customFilter: params.customFilter,
      }),
    );
  }

  return (
    <Suspense fallback={<UserPageLoadingSpinner />}>
      <ErrorBoundary>
        <PageShell>
          <UserPageEditor />
        </PageShell>
      </ErrorBoundary>
    </Suspense>
  );
}
