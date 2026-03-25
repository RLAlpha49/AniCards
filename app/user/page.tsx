import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import PageShell from "@/components/PageShell";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { UserPageEditor } from "@/components/user/UserPageEditor";
import {
  generateMetadata as createMetadata,
  getUserPageSEOConfig,
  getUserProfilePath,
} from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

/**
 * Forces Next.js to render this route on each request so user data stays fresh.
 * @source
 */
export const dynamic = "force-dynamic";

function buildLegacyUserRedirectUrl(params: {
  username: string;
  q?: string;
  visibility?: string;
  group?: string;
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
  }>;
}>) {
  const params = await searchParams;

  if (!params.userId && params.username?.trim()) {
    redirect(
      buildLegacyUserRedirectUrl({
        username: params.username,
        q: params.q,
        visibility: params.visibility,
        group: params.group,
      }),
    );
  }

  const userPageSeo = getUserPageSEOConfig({
    username: params.username,
    userId: params.userId,
    q: params.q,
    visibility: params.visibility,
    group: params.group,
    routeType: "lookup",
  });

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("user", userPageSeo)}
      />
      <Suspense
        fallback={
          <PageShell>
            <div className="
              relative z-10 container mx-auto flex min-h-screen items-center justify-center px-4
            ">
              <LoadingSpinner size="lg" text="Loading user data..." />
            </div>
          </PageShell>
        }
      >
        <ErrorBoundary>
          <PageShell>
            <UserPageEditor />
          </PageShell>
        </ErrorBoundary>
      </Suspense>
    </>
  );
}
