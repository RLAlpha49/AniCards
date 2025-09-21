"use client";

import { CardList } from "@/components/user/card-list";
import { displayNames } from "@/components/stat-card-generator/stat-card-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/loading-spinner";

interface UserData {
  userId: string;
  username?: string;
}

interface CardData {
  cardName: string;
  variation?: string;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
}

// Client component for the interactive user page
export function UserPageClient() {
  const searchParams = useSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userId = searchParams.get("userId");
        const username = searchParams.get("username");
        const cardsParam = searchParams.get("cards");

        let resolvedUserData: UserData | null = null;
        let resolvedCards: CardData[] = [];

        if (cardsParam && (userId || username)) {
          if (userId) {
            resolvedUserData = { userId, username: username || undefined };
          } else if (username) {
            const userRes = await fetch(`/api/user?username=${username}`);
            resolvedUserData = await userRes.json();
          }
          resolvedCards = JSON.parse(cardsParam);
        } else if (userId) {
          const [userRes, cardsRes] = await Promise.all([
            fetch(`/api/user?userId=${userId}`),
            fetch(`/api/cards?userId=${userId}`),
          ]);
          resolvedUserData = await userRes.json();
          const cardsData = await cardsRes.json();
          resolvedCards = cardsData.cards || [];
          setShowAllCards(true);
        } else if (username) {
          const userRes = await fetch(`/api/user?username=${username}`);
          resolvedUserData = await userRes.json();
          if (resolvedUserData?.userId) {
            const cardsRes = await fetch(
              `/api/cards?userId=${resolvedUserData.userId}`,
            );
            const cardsData = await cardsRes.json();
            resolvedCards = cardsData.cards || [];
            setShowAllCards(true);
          }
        }

        setUserData(resolvedUserData);
        setCards(resolvedCards);
      } catch (err) {
        console.error("Data loading error:", err);
        setError("Error loading data");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
          <LoadingSpinner size="lg" text="Loading user data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Error
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Transform card data into format suitable for CardList component
  const cardTypes = cards.map((card) => {
    const variation = card.variation || "default";
    const displayName = displayNames[card.cardName] || card.cardName;
    const isStatusDist = [
      "animeStatusDistribution",
      "mangaStatusDistribution",
    ].includes(card.cardName);
    const isPieCapable = [
      "animeGenres",
      "animeTags",
      "animeVoiceActors",
      "animeStudios",
      "animeStaff",
      "mangaGenres",
      "mangaTags",
      "mangaStaff",
      "animeFormatDistribution",
      "mangaFormatDistribution",
      "animeStatusDistribution",
      "mangaStatusDistribution",
      "animeCountry",
      "mangaCountry",
    ].includes(card.cardName);
    const extraParams = [
      isStatusDist && card.useStatusColors ? "statusColors=true" : null,
      isPieCapable && card.showPiePercentages ? "piePercentages=true" : null,
    ]
      .filter(Boolean)
      .join("&");
    const svgUrlBase = `/api/card.svg?cardType=${card.cardName}&userId=${userData?.userId}&variation=${variation}`;
    const svgUrl = extraParams ? `${svgUrlBase}&${extraParams}` : svgUrlBase;
    return {
      type: displayName,
      svgUrl,
      rawType: card.cardName,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            {userData?.username
              ? `${userData.username}'s Stat Cards`
              : "User Stat Cards"}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            {userData?.username
              ? `View and download ${userData.username}'s beautiful anime and manga statistics`
              : "View and download beautiful anime and manga statistics"}
          </p>
        </motion.div>

        {cardTypes.length > 0 && (
          <div className="mb-8 space-y-6">
            {/* Cache Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto max-w-4xl"
            >
              <div className="rounded-2xl border border-blue-200/50 bg-blue-50/50 p-6 backdrop-blur-sm dark:border-blue-800/30 dark:bg-blue-900/20">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-500 p-2">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-semibold text-blue-800 dark:text-blue-300">
                      Cache Information
                    </h3>
                    <p className="mb-3 text-blue-700 dark:text-blue-400">
                      SVG cards are cached for 24 hours for better performance.
                      If your updates aren&apos;t visible immediately:
                    </p>
                    <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-300">
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                        Hard refresh (
                        <kbd className="rounded border bg-blue-100 px-1.5 py-0.5 text-xs dark:bg-blue-800">
                          Ctrl+F5
                        </kbd>{" "}
                        or{" "}
                        <kbd className="rounded border bg-blue-100 px-1.5 py-0.5 text-xs dark:bg-blue-800">
                          Cmd+Shift+R
                        </kbd>{" "}
                        )
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                        Clear your browser cache
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                        Wait up to 24 hours for automatic refresh
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Credits Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mx-auto max-w-4xl"
            >
              <div className="rounded-2xl border border-green-200/50 bg-green-50/50 p-6 backdrop-blur-sm dark:border-green-800/30 dark:bg-green-900/20">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-green-500 p-2">
                    <svg
                      className="h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-semibold text-green-800 dark:text-green-300">
                      Spread the Love
                    </h3>
                    <p className="mb-3 text-green-700 dark:text-green-400">
                      Found AniCards useful? Help others discover it too!
                      Consider crediting:
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href="https://anilist.co/user/Alpha49"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700/50"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        @Alpha49 on AniList
                      </a>
                      <a
                        href={process.env.NEXT_PUBLIC_API_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700/50"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        AniCards Website
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {cardTypes.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col items-center gap-8"
          >
            {/* Action Buttons */}
            {!showAllCards && cardTypes.length < 11 && (
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
                >
                  <Link
                    href={{
                      pathname: "/user",
                      query: {
                        userId: userData?.userId,
                        username: userData?.username,
                      },
                    }}
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                    View All Generated Cards
                  </Link>
                </Button>
              </div>
            )}

            {/* Cards Display */}
            <div className="w-full">
              <CardList cardTypes={cardTypes} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="rounded-2xl border border-white/20 bg-white/10 p-12 text-center backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/20">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <svg
                  className="h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
                No Cards Found
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-300">
                This user hasn&apos;t generated any stat cards yet.
              </p>
              <Button
                asChild
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
              >
                <Link href="/">Generate Your First Card</Link>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Other Projects CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/20 md:p-12">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
              Explore More Projects
            </h2>
            <p className="mb-8 text-lg text-gray-600 dark:text-gray-300">
              Discover other tools and utilities I&apos;ve built for the anime
              community.
            </p>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-purple-300 text-purple-600 transition-all duration-300 hover:border-purple-400 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-900/20"
            >
              <Link href="/projects">
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Check Out My Other Projects
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
