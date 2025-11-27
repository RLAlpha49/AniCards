import { Suspense } from "react";
import { Metadata } from "next";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { UserPageClient } from "@/components/user/user-page-client";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBoundary } from "@/components/error-boundary";
import { GridPattern } from "@/components/ui/grid-pattern";

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
        <div className="relative min-h-screen w-full overflow-hidden">
          {/* Background effects matching other pages */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
            <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
          </div>
          <GridPattern className="z-0" />
          <div className="container relative z-10 mx-auto flex min-h-screen items-center justify-center px-4">
            <LoadingSpinner size="lg" text="Loading user data..." />
          </div>
        </div>
      }
    >
      <ErrorBoundary>
        <UserPageClient />
      </ErrorBoundary>
    </Suspense>
  );
}
