import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import PageShell from "@/components/PageShell";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { UserPageEditor } from "@/components/user/UserPageEditor";
import { UserPageLoadingSpinner } from "@/components/user/UserPageLoading";
import { isValidUsername } from "@/lib/api/validation";
import { resolveUserIdFromUsername } from "@/lib/card-data";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { getRequestNonce } from "@/lib/request-nonce";
import {
  generateMetadata as createMetadata,
  getUserPageSEOConfig,
} from "@/lib/seo";
import {
  fetchUserDataSnapshot,
  normalizeUsernameIndexValue,
} from "@/lib/server/user-data";

import LoadingPreview from "./loading";

export const dynamic = "force-dynamic";

type ResolvedPublicProfile = {
  canonicalUsername: string;
};

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

function getPersistedCanonicalUsername(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}

function getObjectProperty(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value[key as keyof typeof value];
}

async function resolvePublicProfile(
  username: string,
): Promise<ResolvedPublicProfile | null> {
  const requestedUsername = username.trim();

  if (!isValidUsername(requestedUsername)) {
    return null;
  }

  const normalizedRequestedUsername =
    normalizeUsernameIndexValue(requestedUsername);

  if (!normalizedRequestedUsername) {
    return null;
  }

  const resolvedUserId = await resolveUserIdFromUsername(requestedUsername);

  if (!resolvedUserId) {
    return null;
  }

  const { parts, state } = await fetchUserDataSnapshot(
    resolvedUserId,
    ["meta"],
    {
      audit: false,
    },
  );

  const metaUsername = getPersistedCanonicalUsername(
    getObjectProperty(parts.meta, "username"),
  );
  const canonicalUsername =
    getPersistedCanonicalUsername(state?.username) ?? metaUsername;

  if (!canonicalUsername) {
    return null;
  }

  if (
    normalizeUsernameIndexValue(canonicalUsername) !==
    normalizedRequestedUsername
  ) {
    return null;
  }

  return {
    canonicalUsername,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: UserProfilePageProps): Promise<Metadata> {
  const [{ username }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const resolvedProfile = await resolvePublicProfile(username);

  if (!resolvedProfile) {
    notFound();
  }

  return createMetadata(
    getUserPageSEOConfig({
      username: resolvedProfile.canonicalUsername,
      q: resolvedSearchParams.q,
      visibility: resolvedSearchParams.visibility,
      group: resolvedSearchParams.group,
      customFilter: resolvedSearchParams.customFilter,
      isPublicProfileResolved: true,
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

  const [resolvedSearchParams, nonce, resolvedProfile] = await Promise.all([
    searchParams,
    getRequestNonce(),
    params.then(({ username: routeUsername }) =>
      resolvePublicProfile(routeUsername),
    ),
  ]);

  if (!resolvedProfile) {
    notFound();
  }

  const userPageSeo = getUserPageSEOConfig({
    username: resolvedProfile.canonicalUsername,
    q: resolvedSearchParams.q,
    visibility: resolvedSearchParams.visibility,
    group: resolvedSearchParams.group,
    customFilter: resolvedSearchParams.customFilter,
    isPublicProfileResolved: true,
    routeType: "profile",
  });

  return (
    <>
      <StructuredDataScript
        nonce={nonce}
        page="user"
        overrides={{
          ...userPageSeo,
          profile: {
            username: resolvedProfile.canonicalUsername,
          },
        }}
      />
      <Suspense fallback={<UserPageLoadingSpinner />}>
        <ErrorBoundary>
          <PageShell>
            <UserPageEditor routeUsername={resolvedProfile.canonicalUsername} />
          </PageShell>
        </ErrorBoundary>
      </Suspense>
    </>
  );
}
