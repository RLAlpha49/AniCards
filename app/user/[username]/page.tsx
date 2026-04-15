import "driver.js/dist/driver.css";
import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import PageShell from "@/components/PageShell";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { UserPageEditor } from "@/components/user/UserPageEditor";
import { UserPageLoadingSpinner } from "@/components/user/UserPageLoading";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  generateMetadata as createMetadata,
  getUserPageSEOConfig,
} from "@/lib/seo";

import LoadingPreview from "./loading";

export const dynamic = "force-dynamic";

interface UserProfilePageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    q?: string;
    visibility?: string;
    group?: string;
    customFilter?: string;
  }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: UserProfilePageProps): Promise<Metadata> {
  const [{ username }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  return createMetadata(
    getUserPageSEOConfig({
      username,
      q: resolvedSearchParams.q,
      visibility: resolvedSearchParams.visibility,
      group: resolvedSearchParams.group,
      customFilter: resolvedSearchParams.customFilter,
      routeType: "profile",
    }),
  );
}

export default async function UserProfilePage({
  params,
  searchParams,
}: Readonly<UserProfilePageProps>) {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const [{ username }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const userPageSeo = getUserPageSEOConfig({
    username,
    q: resolvedSearchParams.q,
    visibility: resolvedSearchParams.visibility,
    group: resolvedSearchParams.group,
    customFilter: resolvedSearchParams.customFilter,
    routeType: "profile",
  });

  return (
    <>
      <StructuredDataScript
        page="user"
        overrides={{
          ...userPageSeo,
          profile: {
            username,
          },
        }}
      />
      <Suspense fallback={<UserPageLoadingSpinner />}>
        <ErrorBoundary>
          <PageShell>
            <UserPageEditor routeUsername={username} />
          </PageShell>
        </ErrorBoundary>
      </Suspense>
    </>
  );
}
