"use client";

import { CardList } from "@/components/user/card-list";
import { displayNames } from "@/components/stat-card-generator/stat-card-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Info,
  Sparkles,
  ArrowRight,
  ExternalLink,
  User,
  BarChart2,
  Heart,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/loading-spinner";
import { GridPattern } from "@/components/ui/grid-pattern";
import { FloatingCardsLayer } from "@/components/ui/floating-cards";

/**
 * Basic user identity returned from the API.
 * @property userId - AniList numeric user id.
 * @property username - Optional AniList username for display.
 * @source
 */
interface UserData {
  userId: string;
  username?: string;
}

/**
 * Shape of a card configuration entry used to request or render a stat card.
 * @property cardName - Internal card key used to generate the SVG.
 * @property variation - Optional card variation identifier.
 * @property useStatusColors - Optional flag to render status distribution with color hints.
 * @property showPiePercentages - Optional flag to toggle pie chart percentage labels.
 * @source
 */
interface CardData {
  cardName: string;
  variation?: string;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
}

/**
 * Animation variants for staggered content reveal.
 * @source
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// Validation helpers
/**
 * Narrowing helper that checks whether the given userId is a valid AniList numeric id string.
 * @param userId - The candidate userId string or null.
 * @returns True if userId is a numeric string.
 * @source
 */
const isValidUserId = (userId: string | null): userId is string => {
  if (!userId) return false;
  return /^\d+$/.test(userId);
};

/**
 * Narrowing helper that checks whether the username matches expected AniList username patterns.
 * @param username - The candidate username string or null.
 * @returns True if username is valid.
 * @source
 */
const isValidUsername = (username: string | null): username is string => {
  if (!username) return false;
  return /^[a-zA-Z0-9_-]{2,}$/.test(username);
};

/**
 * Parse a JSON-encoded cards parameter and filter invalid entries.
 * @param cardsParam - JSON string representing an array of CardData entries.
 * @returns Filtered CardData array.
 * @throws {TypeError} If the parameter is not an array.
 * @source
 */
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

/**
 * Client-side component rendering an interactive user page with stat cards.
 * It reads query parameters to resolve a user and card configurations, fetches
 * required data if needed, then renders a grid of cards with actions.
 * @returns JSX element for the user's stat cards page.
 * @source
 */
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

        if (!isValidUserId(userId)) {
          userId = null;
        }
        if (!isValidUsername(username)) {
          username = null;
        }

        let resolvedUserData: UserData | null = null;
        let resolvedCards: CardData[] = [];

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

  // Loading state with consistent styling
  if (loading) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
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
    );
  }

  // Error state with consistent styling
  if (error) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
        </div>
        <GridPattern className="z-0" />
        <div className="container relative z-10 mx-auto flex min-h-screen items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className="rounded-3xl border border-red-200/50 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-red-800/30 dark:bg-slate-900/80">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                Something Went Wrong
              </h1>
              <p className="mb-6 text-slate-600 dark:text-slate-300">{error}</p>
              <Button
                asChild
                className="rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg"
              >
                <Link href="/">Return Home</Link>
              </Button>
            </div>
          </motion.div>
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

  /**
   * Preferred ordering for specific card types so they appear earlier in the UI.
   * @source
   */
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
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
        </div>
        <GridPattern className="z-0" />
        <div className="container relative z-10 mx-auto flex min-h-screen items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className="rounded-3xl border border-slate-200/50 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <User className="h-10 w-10 text-slate-400" />
              </div>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                User Not Found
              </h1>
              <p className="mb-6 text-slate-600 dark:text-slate-300">
                Unable to load user data. Please try again.
              </p>
              <Button
                asChild
                className="rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg"
              >
                <Link href="/">Return Home</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      {/* Background effects matching other pages */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-cyan-400/15 to-blue-400/15 blur-3xl" />
        <div className="absolute left-0 top-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/10 to-orange-500/10 blur-3xl" />
      </div>

      <GridPattern className="z-0" />

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative w-full overflow-hidden">
          {cardTypes.length > 0 && <FloatingCardsLayer layout="search" />}

          <div className="container relative z-10 mx-auto px-4 py-16 lg:py-24">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mx-auto flex max-w-4xl flex-col items-center text-center"
            >
              {/* Badge */}
              <motion.div variants={itemVariants}>
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300">
                  <Sparkles className="h-4 w-4" />
                  User Statistics
                </span>
              </motion.div>

              {/* Main heading */}
              <motion.h1
                variants={itemVariants}
                className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
              >
                {userData?.username ? (
                  <>
                    {userData.username}&apos;s{" "}
                    <span className="relative">
                      <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Stat Cards
                      </span>
                      <motion.span
                        className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                        animate={{ opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    </span>
                  </>
                ) : (
                  <>
                    User{" "}
                    <span className="relative">
                      <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Stat Cards
                      </span>
                      <motion.span
                        className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                        animate={{ opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    </span>
                  </>
                )}
              </motion.h1>

              {/* Subheading */}
              <motion.p
                variants={itemVariants}
                className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
              >
                {userData?.username
                  ? `View and download ${userData.username}'s beautiful anime and manga statistics`
                  : "View and download beautiful anime and manga statistics"}
              </motion.p>

              {/* Stats Summary */}
              {cardTypes.length > 0 && (
                <motion.div
                  variants={itemVariants}
                  className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-2"
                >
                  <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-5 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
                    <div className="mb-3 inline-flex rounded-xl bg-blue-100 p-2.5 dark:bg-blue-900/30">
                      <BarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                      {cardTypes.length}
                    </div>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Stat Cards
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-5 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
                    <div className="mb-3 inline-flex rounded-xl bg-purple-100 p-2.5 dark:bg-purple-900/30">
                      <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="truncate text-3xl font-bold text-slate-900 dark:text-white">
                      {userData?.username || `#${userData?.userId}`}
                    </div>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      AniList User
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Info Cards Section */}
        {cardTypes.length > 0 && (
          <section className="relative w-full overflow-hidden pb-8">
            <div className="container relative mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2"
              >
                {/* Cache Notice */}
                <div className="group rounded-2xl border border-blue-200/50 bg-white/80 p-6 backdrop-blur-sm transition-all hover:border-blue-300/50 hover:shadow-lg dark:border-blue-800/30 dark:bg-slate-800/80 dark:hover:border-blue-700/50">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-blue-100 p-3 dark:bg-blue-900/30">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">
                        Cache Information
                      </h3>
                      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                        SVG cards are cached for 24 hours for better
                        performance.
                      </p>
                      <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <p className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          Hard refresh:{" "}
                          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                            Ctrl+F5
                          </kbd>{" "}
                          or{" "}
                          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                            Cmd+Shift+R
                          </kbd>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Clear your browser cache</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Credits Notice */}
                <div className="group rounded-2xl border border-green-200/50 bg-white/80 p-6 backdrop-blur-sm transition-all hover:border-green-300/50 hover:shadow-lg dark:border-green-800/30 dark:bg-slate-800/80 dark:hover:border-green-700/50">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-green-100 p-3 dark:bg-green-900/30">
                      <Heart className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">
                        Spread the Love
                      </h3>
                      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                        Found AniCards useful? Help others discover it too! A
                        credit to myself or the site would be greatly
                        appreciated.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="https://anilist.co/user/Alpha49"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/50"
                        >
                          <ExternalLink className="h-3 w-3" />
                          @Alpha49
                        </a>
                        <a
                          href={process.env.NEXT_PUBLIC_API_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/50"
                        >
                          <ExternalLink className="h-3 w-3" />
                          AniCards
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Cards Section */}
        <section className="relative w-full overflow-hidden py-8 lg:py-16">
          <div className="container relative mx-auto px-4">
            {cardTypes.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-8"
              >
                {/* View All Cards Button */}
                {!showAllCards && cardTypes.length < 11 && (
                  <Button
                    asChild
                    size="lg"
                    className="group rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
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
                )}

                {/* Cards Display */}
                <div className="w-full">
                  <CardList cardTypes={sortedCardTypes} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center py-16"
              >
                <div className="w-full max-w-md rounded-3xl border border-slate-200/50 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Info className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
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
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative w-full overflow-hidden py-20">
          {/* Background gradient orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl" />
            <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/20 to-orange-500/20 blur-3xl" />
          </div>

          <div className="container relative mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="mx-auto max-w-4xl"
            >
              <div className="rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 p-8 text-center shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50 sm:p-12 lg:p-16">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="space-y-6"
                >
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                    Explore More{" "}
                    <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Projects
                    </span>
                  </h2>

                  <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                    Discover other tools and utilities built for the anime
                    community.
                  </p>

                  <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="group h-14 min-w-[220px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30"
                    >
                      <Link href="/projects">
                        View Projects
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
