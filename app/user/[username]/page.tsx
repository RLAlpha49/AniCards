import type { Metadata } from "next";
import { Suspense } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import PageShell from "@/components/PageShell";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { UserPageEditor } from "@/components/user/UserPageEditor";
import {
  generateMetadata as createMetadata,
  getUserPageSEOConfig,
} from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

interface UserProfilePageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    q?: string;
    visibility?: string;
    group?: string;
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
      routeType: "profile",
    }),
  );
}

export default async function UserProfilePage({
  params,
  searchParams,
}: Readonly<UserProfilePageProps>) {
  const [{ username }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const userPageSeo = getUserPageSEOConfig({
    username,
    q: resolvedSearchParams.q,
    visibility: resolvedSearchParams.visibility,
    group: resolvedSearchParams.group,
    routeType: "profile",
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
            <UserPageEditor routeUsername={username} />
          </PageShell>
        </ErrorBoundary>
      </Suspense>
    </>
  );
}
