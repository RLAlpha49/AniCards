import { Suspense } from "react";
import { Metadata } from "next";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { UserPageClient } from "@/components/user/UserPageClient";
import { UserPageState } from "@/components/user/UserPageState";
import { PaperSurface } from "@/components/PaperSurface";

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
      title: `${username}'s AniList Stat Cards - AniCards`,
      description: `The AniList stat cards saved for ${username}: download the set, copy a card's link, or embed it on a profile.`,
      keywords: [
        `${username} anilist`,
        `${username} stat cards`,
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
 * Wraps the client-side user page in a suspense boundary with a reading state.
 *
 * The fallback paints the same paper surface as the page itself, so the
 * background never flashes to a different colour while the record loads.
 * @source
 */
export default function UserPage() {
  return (
    <Suspense
      fallback={
        <PaperSurface>
          <UserPageState state="loading" />
        </PaperSurface>
      }
    >
      <UserPageClient />
    </Suspense>
  );
}
