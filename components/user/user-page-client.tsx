"use client";

import { CardList } from "@/components/user/card-list";
import { displayNames } from "@/components/stat-card-generator/stat-card-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Info, Sparkles, ArrowRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GridPattern } from "../ui/grid-pattern";

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

// Validation helpers
const isValidUserId = (userId: string | null): userId is string => {
  if (!userId) return false;
  // userId should be numeric string from AniList
  return /^\d+$/.test(userId);
};

const isValidUsername = (username: string | null): username is string => {
  if (!username) return false;
  // Username can contain letters, numbers, underscores, hyphens (AniList standard)
  return /^[a-zA-Z0-9_-]{2,}$/.test(username);
};

// Helper to load and validate cards from parameter
const parseAndValidateCards = (cardsParam: string): CardData[] => {
  try {
    const parsedCards = JSON.parse(cardsParam);

    if (!Array.isArray(parsedCards)) {
      throw new TypeError("Cards parameter must be an array");
    }

    return parsedCards.filter((card) => {
      if (typeof card !== "object" || card === null) {
        console.warn("Invalid card object:", card);
        return false;
      }
      if (typeof card.cardName !== "string" || !card.cardName) {
        console.warn("Card missing required cardName:", card);
        return false;
      }
      return true;
    });
  } catch (error_) {
    console.error("Failed to parse cards parameter:", error_);
    throw error_;
  }
};

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
        let userId = searchParams.get("userId");
        let username = searchParams.get("username");
        const cardsParam = searchParams.get("cards");

        // Validate parameters before using them
        if (!isValidUserId(userId)) {
          userId = null;
        }
        if (!isValidUsername(username)) {
          username = null;
        }

        let resolvedUserData: UserData | null = null;
        let resolvedCards: CardData[] = [];

        // Try to parse cards if provided
        if (cardsParam) {
          try {
            resolvedCards = parseAndValidateCards(cardsParam);
          } catch (error_) {
            console.error("Failed to parse cards parameter:", error_);
            setError("Invalid card configuration. Please try again.");
            setLoading(false);
            return;
          }
        }

        // Load user data and cards based on parameters
        if (cardsParam && (userId || username)) {
          if (userId) {
            resolvedUserData = { userId, username: username || undefined };
          } else if (username) {
            const userRes = await fetch(
              `/api/user?username=${encodeURIComponent(username)}`,
            );
            resolvedUserData = await userRes.json();
          }
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
          const userRes = await fetch(
            `/api/user?username=${encodeURIComponent(username)}`,
          );
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
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
          <LoadingSpinner size="lg" text="Loading user data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
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

  const priorityOrder = ["animeStats", "mangaStats", "socialStats"];

  const sortedCardTypes = [...cardTypes].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.rawType);
    const bPriority = priorityOrder.indexOf(b.rawType);

    if (aPriority !== -1 || bPriority !== -1) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }

    return a.type.localeCompare(b.type);
  });

  // Guard: Ensure userData is present before rendering URLs
  if (!userData) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Invalid User
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Unable to load user data. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <GridPattern className="z-0" includeGradients={true} />

      <div className="container relative z-10 mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-16 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>User Statistics</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
          >
            {userData?.username ? (
              <>
                {userData.username}&apos;s{" "}
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Stat Cards
                </span>
              </>
            ) : (
              <>
                User{" "}
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Stat Cards
                </span>
              </>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
          >
            {userData?.username
              ? `View and download ${userData.username}'s beautiful anime and manga statistics`
              : "View and download beautiful anime and manga statistics"}
          </motion.p>
        </div>

        {cardTypes.length > 0 && (
          <div className="mb-8 space-y-6">
            {/* Cache Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto w-fit"
            >
              <Card className="h-full border-blue-200/50 bg-blue-50/50 backdrop-blur-sm dark:border-blue-800/30 dark:bg-blue-900/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <CardTitle className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Cache Information
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-blue-800 dark:text-blue-200">
                    SVG cards are cached for 24 hours for better performance. If
                    your updates aren&apos;t visible immediately:
                  </p>
                  <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                      <span>
                        Hard refresh (
                        <kbd className="rounded border bg-blue-100 px-1.5 py-0.5 text-xs dark:bg-blue-800">
                          Ctrl+F5
                        </kbd>{" "}
                        or{" "}
                        <kbd className="rounded border bg-blue-100 px-1.5 py-0.5 text-xs dark:bg-blue-800">
                          Cmd+Shift+R
                        </kbd>
                        )
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                      Clear your browser cache
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Credits Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mx-auto w-fit"
            >
              <Card className="h-full border-green-200/50 bg-green-50/50 backdrop-blur-sm dark:border-green-800/30 dark:bg-green-900/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                    </div>
                    <CardTitle className="text-lg font-semibold text-green-900 dark:text-green-100">
                      Spread the Love
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-green-800 dark:text-green-200">
                    Found AniCards useful? Help others discover it too! Consider
                    crediting:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="https://anilist.co/user/Alpha49"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700/50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      @Alpha49 on AniList
                    </a>
                    <a
                      href={process.env.NEXT_PUBLIC_API_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700/50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      AniCards Website
                    </a>
                  </div>
                </CardContent>
              </Card>
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
                  className="group rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
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
                    <span className="mr-2">View All Generated Cards</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Cards Display */}
            <div className="w-full">
              <CardList cardTypes={sortedCardTypes} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <Card className="w-full max-w-md border-gray-200 bg-white/80 text-center shadow-2xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
              <CardContent className="pt-12">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Info className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
                  No Cards Found
                </h3>
                <p className="mb-8 text-slate-600 dark:text-slate-300">
                  This user hasn&apos;t generated any stat cards yet.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="group w-full rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                >
                  <Link href="/">
                    Generate Your First Card
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Other Projects CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-24 text-center"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-16 text-white shadow-2xl dark:from-slate-800 dark:to-slate-900 sm:px-12">
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Explore More Projects
              </h2>
              <p className="mb-8 text-lg text-slate-300">
                Discover other tools and utilities I&apos;ve built for the anime
                community.
              </p>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
              >
                <Link href="/projects">
                  Check Out My Other Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
