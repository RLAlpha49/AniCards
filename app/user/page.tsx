import { Suspense } from "react";
import { Metadata } from "next";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { UserPageClient } from "@/components/user/user-page-client";
import { LoadingSpinner } from "@/components/loading-spinner";

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = "force-dynamic";

// Generate metadata dynamically based on the user
export async function generateMetadata(props: {
  searchParams: Promise<{
    userId?: string;
    username?: string;
    cards?: string;
    showFavorites?: string;
    animeStatusColors?: string;
    mangaStatusColors?: string;
  }>;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const username = searchParams.username;

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

// Server component wrapper that handles metadata and renders the client component
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
