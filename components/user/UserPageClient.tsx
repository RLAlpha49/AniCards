"use client";

import { CardList } from "@/components/user/CardList";
import { displayNames } from "@/components/stat-card-generator/StatCardPreview";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import CTASection from "@/components/CTASection";
import {
  Info,
  Sparkles,
  ArrowRight,
  ExternalLink,
  User,
  Heart,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { FloatingCardsLayer } from "@/components/FloatingCardsLayer";
import {
  getAbsoluteUrl,
  getCardBorderRadius,
  getResponseErrorMessage,
  parseResponsePayload,
} from "@/lib/utils";
import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";

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
 * @property showFavorites - Optional flag to show favorites indicator.
 * @property titleColor - Title color (hex or gradient).
 * @property backgroundColor - Background color (hex or gradient).
 * @property textColor - Text color (hex or gradient).
 * @property circleColor - Circle/accent color (hex or gradient).
 * @property borderColor - Optional border color.
 * @property borderRadius - Optional border radius.
 * @source
 */
interface CardData {
  cardName: string;
  variation?: string;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  borderRadius?: number;
  // Color configuration
  titleColor?: string;
  backgroundColor?: string;
  textColor?: string;
  circleColor?: string;
  borderColor?: string;
  // Color preset name (if not "custom", use preset instead of individual colors)
  colorPreset?: string;
}

type ApiUser = { userId?: string | number; username?: string };
type ApiCards = { userId?: number | string; cards?: CardData[] };

/**
 * Fetch JSON from the given URL and perform minimal validation for 'user' or 'cards'.
 * Errors are reported via the provided setError callback and null is returned
 * to indicate failure.
 */
async function fetchJsonWithValidation<T>(
  url: string,
  kind: "user" | "cards",
  setErrorCallback: (v: string | null) => void,
): Promise<T | null> {
  try {
    const res = await fetch(url);
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const bodyMsg = getResponseErrorMessage(res, payload);
      setErrorCallback(
        kind === "user"
          ? `Failed to load user (${bodyMsg})`
          : `Failed to load cards (${bodyMsg})`,
      );
      return null;
    }

    if (kind === "user") {
      const p = payload as ApiUser;
      if (!p || typeof p !== "object" || (!p.userId && !p.username)) {
        setErrorCallback("Failed to load user: invalid response format");
        return null;
      }
    } else {
      const p = payload as ApiCards;
      if (!p || typeof p !== "object" || !Array.isArray(p.cards)) {
        setErrorCallback("Failed to load cards: invalid response format");
        return null;
      }
    }

    return payload as T;
  } catch (error_) {
    setErrorCallback(
      kind === "user" ? "Failed to load user" : "Failed to load cards",
    );
    console.error("Network error while fetching", url, error_);
    return null;
  }
}

/**
 * Fetch a user by numeric id.
 */
async function fetchUserById(
  userId: string,
  setErrorCallback: (v: string | null) => void,
): Promise<ApiUser | null> {
  return fetchJsonWithValidation<ApiUser>(
    `/api/get-user?userId=${userId}`,
    "user",
    setErrorCallback,
  );
}

/**
 * Fetch a user by username.
 */
async function fetchUserByUsername(
  username: string,
  setErrorCallback: (v: string | null) => void,
): Promise<ApiUser | null> {
  return fetchJsonWithValidation<ApiUser>(
    `/api/get-user?username=${encodeURIComponent(username)}`,
    "user",
    setErrorCallback,
  );
}

/**
 * Fetch cards for a user id.
 */
async function fetchCardsForUserId(
  userId: string,
  setErrorCallback: (v: string | null) => void,
): Promise<ApiCards | null> {
  return fetchJsonWithValidation<ApiCards>(
    `/api/get-cards?userId=${userId}`,
    "cards",
    setErrorCallback,
  );
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
  const pageTimestamp = useMemo(() => Date.now(), []);

  async function resolveCardsFromParam(
    cardsParam: string,
  ): Promise<CardData[] | null> {
    try {
      return parseAndValidateCards(cardsParam);
    } catch (e) {
      console.error("Failed to parse cards parameter:", e);
      setError("Invalid card configuration. Please try again.");
      setLoading(false);
      return null;
    }
  }

  async function resolveUserFromUsername(
    username: string,
  ): Promise<UserData | null> {
    const userResult = await fetchUserByUsername(username, setError);
    if (!userResult) return null;
    return {
      userId: String(userResult.userId),
      username: userResult.username || undefined,
    };
  }

  async function resolveUserWithCardsForId(
    userIdArg: string,
  ): Promise<{ user: UserData | null; cards: CardData[] | null } | null> {
    const userResult = await fetchUserById(userIdArg, setError);
    if (!userResult) return null;
    const cardsResult = await fetchCardsForUserId(userIdArg, setError);
    if (!cardsResult) return null;
    const resolvedCards = extractValidatedCards(cardsResult);
    return {
      user: {
        userId: String(userResult.userId),
        username: userResult.username || undefined,
      },
      cards: resolvedCards,
    };
  }

  function extractValidatedCards(raw: unknown): CardData[] {
    const a = (raw as ApiCards).cards || [];
    return a.map(normalizeCardEntry).filter(Boolean) as CardData[];
  }

  function normalizeCardEntry(raw: unknown): CardData | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.cardName !== "string" || !r.cardName) return null;
    return {
      cardName: r.cardName,
      variation: typeof r.variation === "string" ? r.variation : undefined,
      useStatusColors:
        typeof r.useStatusColors === "boolean" ? r.useStatusColors : undefined,
      showPiePercentages:
        typeof r.showPiePercentages === "boolean"
          ? r.showPiePercentages
          : undefined,
      showFavorites:
        typeof r.showFavorites === "boolean" ? r.showFavorites : undefined,
      borderRadius:
        typeof r.borderRadius === "number" && Number.isFinite(r.borderRadius)
          ? r.borderRadius
          : undefined,
      // Color configuration
      titleColor: typeof r.titleColor === "string" ? r.titleColor : undefined,
      backgroundColor:
        typeof r.backgroundColor === "string" ? r.backgroundColor : undefined,
      textColor: typeof r.textColor === "string" ? r.textColor : undefined,
      circleColor:
        typeof r.circleColor === "string" ? r.circleColor : undefined,
      borderColor:
        typeof r.borderColor === "string" ? r.borderColor : undefined,
      colorPreset:
        typeof r.colorPreset === "string" ? r.colorPreset : undefined,
    };
  }

  async function resolveByParams(
    userIdArg: string | null,
    usernameArg: string | null,
    cardsParamArg: string | null,
  ): Promise<{
    user: UserData | null;
    cards: CardData[];
    showAll: boolean;
  } | null> {
    let finalUser: UserData | null = null;
    let finalCards: CardData[] = [];
    let showAll = false;

    if (cardsParamArg)
      return await handleCardsParamFlow(cardsParamArg, userIdArg, usernameArg);

    if (userIdArg) return await handleUserIdFlow(userIdArg);

    if (usernameArg) return await handleUsernameFlow(usernameArg);

    return { user: null, cards: [], showAll };
  }

  async function handleCardsParamFlow(
    cardsParamArg: string,
    userIdArg: string | null,
    usernameArg: string | null,
  ): Promise<{
    user: UserData | null;
    cards: CardData[];
    showAll: boolean;
  } | null> {
    const parsed = await resolveCardsFromParam(cardsParamArg);
    if (!parsed) return null;
    if (userIdArg) {
      return {
        user: { userId: userIdArg, username: usernameArg || undefined },
        cards: parsed,
        showAll: false,
      };
    }
    if (usernameArg) {
      const finalUser = await resolveUserFromUsername(usernameArg);
      if (!finalUser) return null;
      return { user: finalUser, cards: parsed, showAll: false };
    }
    return { user: null, cards: parsed, showAll: false };
  }

  async function handleUserIdFlow(userIdArg: string): Promise<{
    user: UserData | null;
    cards: CardData[];
    showAll: boolean;
  } | null> {
    const resolved = await resolveUserWithCardsForId(userIdArg);
    if (!resolved) return null;
    return { user: resolved.user, cards: resolved.cards || [], showAll: true };
  }

  async function handleUsernameFlow(usernameArg: string): Promise<{
    user: UserData | null;
    cards: CardData[];
    showAll: boolean;
  } | null> {
    const finalUser = await resolveUserFromUsername(usernameArg);
    if (!finalUser) return null;
    let finalCards: CardData[] = [];
    if (finalUser.userId) {
      const cardsResult = await fetchCardsForUserId(finalUser.userId, setError);
      if (!cardsResult) return null;
      finalCards = extractValidatedCards(cardsResult);
    }
    return {
      user: finalUser,
      cards: finalCards,
      showAll: finalCards.length > 0,
    };
  }

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

        const resolved = await resolveByParams(userId, username, cardsParam);
        if (!resolved) return;
        setUserData(resolved.user);
        setCards(resolved.cards);
        if (resolved.showAll) setShowAllCards(true);
        return;
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
      <div className="container relative z-10 mx-auto flex min-h-screen items-center justify-center px-4">
        <LoadingSpinner size="lg" text="Loading user data..." />
      </div>
    );
  }

  // Error state with consistent styling
  if (error) {
    return (
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
    );
  }

  const cardTimestamp = pageTimestamp;

  const cardTypes = cards.map((card) => {
    const variation = card.variation || "default";
    const displayName = displayNames[card.cardName] || card.cardName;
    const isStatusDist = [
      "animeStatusDistribution",
      "mangaStatusDistribution",
    ].includes(card.cardName);
    const isFavoriteCapable = [
      "animeVoiceActors",
      "animeStudios",
      "animeStaff",
      "mangaStaff",
    ].includes(card.cardName);

    // Determine the effective color preset:
    // 1. If card has a stored colorPreset, use it
    // 2. If no colorPreset stored (legacy data) or has gradient colors, use "custom"
    // Always include colorPreset in URL to tell the API how to resolve colors
    const resolveEffectivePreset = (): string => {
      // If card has a stored preset, use it
      if (card.colorPreset) return card.colorPreset;
      // Legacy data or gradient colors need "custom" to force DB lookup
      return "custom";
    };
    const effectivePreset = resolveEffectivePreset();

    // Never include individual colors in URL - let API resolve from preset or DB
    const includeColors = false;

    // Only include piePercentages for pie variation
    const isPieVariation = variation === "pie";

    const urlParams = mapStoredConfigToCardUrlParams(
      {
        cardName: card.cardName,
        variation,
        colorPreset: effectivePreset,
        titleColor: includeColors ? card.titleColor : undefined,
        backgroundColor: includeColors ? card.backgroundColor : undefined,
        textColor: includeColors ? card.textColor : undefined,
        circleColor: includeColors ? card.circleColor : undefined,
        borderColor: card.borderColor,
        borderRadius: card.borderRadius,
        showFavorites: isFavoriteCapable ? card.showFavorites : undefined,
        useStatusColors: isStatusDist ? card.useStatusColors : undefined,
        showPiePercentages: isPieVariation
          ? card.showPiePercentages
          : undefined,
      },
      {
        userId: userData?.userId,
        includeColors: includeColors,
        defaultToCustomPreset: true,
      },
    );

    const svgUrl = buildCardUrlWithParams(urlParams);
    const urlWithTimestamp = `${svgUrl}&_t=${cardTimestamp}`;
    const cardBorderRadiusValue = getCardBorderRadius(card.borderRadius);
    return {
      type: displayName,
      svgUrl: urlWithTimestamp,
      rawType: card.cardName,
      borderRadius: cardBorderRadiusValue,
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
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="relative">
          {cardTypes.length > 0 && <FloatingCardsLayer layout="search" />}
          <section className="relative w-full overflow-hidden">
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
                            href={getAbsoluteUrl("/")}
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
        </div>

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
          <div className="container relative mx-auto px-4">
            <motion.div className="mx-auto max-w-4xl">
              <CTASection
                title={
                  <>
                    Explore More{" "}
                    <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Projects
                    </span>
                  </>
                }
                subtitle={
                  "Discover other tools and utilities built for the anime community."
                }
                primary={{
                  label: (
                    <>
                      View Projects
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  ),
                  href: "/projects",
                  asChild: true,
                  variant: "outline",
                  className:
                    "border-white/20 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white",
                }}
              />
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
