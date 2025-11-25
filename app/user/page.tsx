import { Suspense } from "react";
import { Metadata } from "next";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { UserPageClient } from "@/components/user/user-page-client";
import { LoadingSpinner } from "@/components/loading-spinner";

/**
 * Forces Next.js to render this route on each request so user data stays fresh.
 * @source
 */
export const dynamic = "force-dynamic";

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
    cards?: string;
    showFavorites?: string;
    animeStatusColors?: string;
    mangaStatusColors?: string;
  }>;
}): Promise<Metadata> {
  const { username } = await searchParams;

  if (username) {
    return createMetadata({
      title: `${username}'s AniList Stats - AniCards`,
      description: `View ${username}'s anime and manga statistics from AniList. Generate and download beautiful stat cards showcasing their viewing habits, preferences, and achievements.`,
      keywords: [
        `${username} anilist`,
        `${username} anime stats`,
        `${username} manga stats`,
        "anilist profile",
        "anime statistics",
        "manga statistics",
        "stat cards",
      ],
      canonical: `https://anicards.vercel.app/user?username=${username}`,
    });
  }

  return createMetadata(seoConfigs.user);
}

/**
 * Wraps the client-side user page in a suspense boundary with a spinner fallback.
 * @source
 */
export default function UserPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
          <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
            <LoadingSpinner size="lg" text="Loading user data..." />
          </div>
        </div>
      }
    >
      <UserPageClient />
    </Suspense>
  );
}
