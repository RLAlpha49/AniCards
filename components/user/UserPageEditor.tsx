"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  LayoutGrid,
  Search,
  ChevronsUpDown,
  Layers,
  Clapperboard,
  BookOpen,
  Activity,
  Library,
  BarChart3,
  Eye,
  EyeOff,
  SlidersHorizontal,
  X,
  RotateCcw,
  AlertTriangle,
  Info,
  RefreshCw,
  Heart,
  ExternalLink,
  UserPlus,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UserPageHeader } from "./UserPageHeader";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import { CardCategorySection } from "./CardCategorySection";
import { CardTile } from "./CardTile";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import { DISABLED_CARD_INFO } from "@/lib/card-info-tooltips";
import {
  useUserPageEditor,
  type ServerCardData,
  type ServerGlobalSettings,
} from "@/lib/stores/user-page-editor";
import type { ReconstructedUserRecord } from "@/lib/types/records";
import { useCardAutoSave } from "@/hooks/useCardAutoSave";
import { statCardTypes } from "@/components/stat-card-generator/constants";
import { cn, getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import { getErrorDetails } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";

/**
 * Loading phases for the user page setup process.
 * @source
 */
type LoadingPhase =
  | "idle"
  | "checking"
  | "setting_up"
  | "fetching_anilist"
  | "saving"
  | "loading_cards"
  | "complete"
  | "error";

/**
 * Human-readable messages for each loading phase.
 * @source
 */
const LOADING_PHASE_MESSAGES: Record<LoadingPhase, string> = {
  idle: "Preparing...",
  checking: "Checking your profile...",
  setting_up: "Setting up your profile...",
  fetching_anilist: "Fetching your stats from AniList...",
  saving: "Saving your profile...",
  loading_cards: "Loading your cards...",
  complete: "Ready!",
  error: "Something went wrong",
};

/**
 * Response from AniList API for user ID lookup.
 * @source
 */
interface AniListUserIdResponse {
  User?: {
    id: number;
  };
  error?: string;
}

/**
 * Response from AniList API for user stats.
 * @source
 */
interface AniListStatsResponse {
  User?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Fetches user ID from AniList by username.
 * @source
 */
async function fetchUserIdFromAniList(
  username: string,
): Promise<{ userId: number } | { error: string }> {
  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: USER_ID_QUERY,
        variables: { userName: username },
      }),
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          error: `User "${username}" not found on AniList. Please check the username and try again.`,
        };
      }
      if (res.status === 429) {
        return {
          error:
            "AniList rate limit reached. Please wait a moment and try again.",
        };
      }
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    const data = payload as AniListUserIdResponse;
    if (!data.User?.id) {
      return { error: `User "${username}" not found on AniList.` };
    }

    return { userId: data.User.id };
  } catch (err) {
    console.error("Error fetching user ID from AniList:", err);
    return {
      error:
        "Failed to connect to AniList. Please check your connection and try again.",
    };
  }
}

/**
 * Fetches full user stats from AniList.
 * @source
 */
async function fetchUserStatsFromAniList(
  userId: number,
): Promise<{ stats: AniListStatsResponse } | { error: string }> {
  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: USER_STATS_QUERY,
        variables: { userId },
      }),
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      if (res.status === 429) {
        return {
          error:
            "AniList rate limit reached. Please wait a moment and try again.",
        };
      }
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { stats: payload as AniListStatsResponse };
  } catch (err) {
    console.error("Error fetching user stats from AniList:", err);
    return { error: "Failed to fetch stats from AniList. Please try again." };
  }
}

/**
 * Saves user data to the database.
 * @source
 */
async function saveUserToDatabase(
  userId: number,
  username: string,
  stats: AniListStatsResponse,
): Promise<{ success: boolean } | { error: string }> {
  try {
    const res = await fetch("/api/store-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        username,
        stats,
      }),
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving user to database:", err);
    return { error: "Failed to save your profile. Please try again." };
  }
}

/**
 * Saves initial card configuration to the database.
 * @source
 */
async function saveInitialCards(
  userId: number,
  stats: AniListStatsResponse,
): Promise<{ success: boolean } | { error: string }> {
  try {
    // Initialize with a full enabled snapshot so the Redis `cards:{userId}`
    // record always contains every supported card type.
    const initialCards = statCardTypes.map((t) => ({
      cardName: t.id,
      disabled: false,
      variation: t.variations[0].id,
      colorPreset: "default",
    }));

    const res = await fetch("/api/store-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        cards: initialCards,
        statsData: stats,
        globalSettings: {
          colorPreset: "default",
          borderEnabled: false,
        },
      }),
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving initial cards:", err);
    return { error: "Failed to initialize cards. Please try again." };
  }
}

/**
 * Card types that support status colors.
 * @source
 */
const STATUS_COLOR_CARDS = new Set([
  "animeStatusDistribution",
  "mangaStatusDistribution",
]);

/**
 * Card types that support pie percentages (for pie/donut variations).
 * @source
 */
const PIE_PERCENTAGE_CARDS = new Set([
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "animeStatusDistribution",
  "animeFormatDistribution",
  "animeSourceMaterialDistribution",
  "animeSeasonalPreference",
  "animeCountry",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "mangaStatusDistribution",
  "mangaFormatDistribution",
  "mangaCountry",
]);

/**
 * Card types that support favorites toggle.
 * @source
 */
const FAVORITES_CARDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/**
 * Validation helpers.
 * @source
 */
const isValidUserId = (userId: string | null): userId is string => {
  if (!userId) return false;
  return /^\d+$/.test(userId);
};

const isValidUsername = (username: string | null): username is string => {
  if (!username) return false;
  return /^[a-zA-Z0-9_.-]{2,}$/.test(username);
};

/**
 * Result of new user setup process.
 * @source
 */
type NewUserSetupResult =
  | {
      success: true;
      userId: number;
      username: string | null;
      avatarUrl: string | null;
      stats: AniListStatsResponse;
    }
  | { error: string };

/**
 * Handles the complete new user setup flow:
 * 1. Resolves userId from username if needed
 * 2. Fetches user stats from AniList
 * 3. Saves user to database
 * 4. Saves initial card configuration
 * @source
 */
async function setupNewUser(
  userIdParam: string | null,
  usernameParam: string | null,
  setLoadingPhase: (phase: LoadingPhase) => void,
): Promise<NewUserSetupResult> {
  setLoadingPhase("setting_up");

  // Resolve userId - we need it for all subsequent operations
  let resolvedUserId: number | null = null;
  let resolvedUsername: string | null = usernameParam;

  if (userIdParam) {
    resolvedUserId = Number.parseInt(userIdParam, 10);
  } else if (usernameParam) {
    setLoadingPhase("fetching_anilist");
    const anilistIdResult = await fetchUserIdFromAniList(usernameParam);

    if ("error" in anilistIdResult) {
      const errorDetails = getErrorDetails(anilistIdResult.error);
      trackUserActionError(
        "new_user_setup_fetch_id",
        new Error(anilistIdResult.error),
        errorDetails.category,
        { username: usernameParam },
      );
      return { error: anilistIdResult.error };
    }

    resolvedUserId = anilistIdResult.userId;
  }

  if (!resolvedUserId) {
    return { error: "Could not determine user ID. Please try again." };
  }

  // Fetch user stats from AniList
  setLoadingPhase("fetching_anilist");
  const statsResult = await fetchUserStatsFromAniList(resolvedUserId);

  if ("error" in statsResult) {
    const errorDetails = getErrorDetails(statsResult.error);
    trackUserActionError(
      "new_user_setup_fetch_stats",
      new Error(statsResult.error),
      errorDetails.category,
      {
        userId: resolvedUserId.toString(),
        username: resolvedUsername ?? undefined,
      },
    );
    return { error: statsResult.error };
  }

  // Extract username from stats if we didn't have it
  const statsUsername = (statsResult.stats.User as Record<string, unknown>)
    ?.name as string | undefined;
  if (!resolvedUsername && statsUsername) {
    resolvedUsername = statsUsername;
  }

  // Save user to database
  setLoadingPhase("saving");
  const saveUserResult = await saveUserToDatabase(
    resolvedUserId,
    resolvedUsername || "",
    statsResult.stats,
  );

  if ("error" in saveUserResult) {
    const errorDetails = getErrorDetails(saveUserResult.error);
    trackUserActionError(
      "new_user_setup_save_user",
      new Error(saveUserResult.error),
      errorDetails.category,
      {
        userId: resolvedUserId.toString(),
        username: resolvedUsername ?? undefined,
      },
    );
    return { error: saveUserResult.error };
  }

  // Save initial card configuration (non-fatal if it fails)
  const saveCardsResult = await saveInitialCards(
    resolvedUserId,
    statsResult.stats,
  );
  if ("error" in saveCardsResult) {
    const errorDetails = getErrorDetails(saveCardsResult.error);
    trackUserActionError(
      "new_user_setup_save_cards",
      new Error(saveCardsResult.error),
      errorDetails.category,
      {
        userId: resolvedUserId.toString(),
        username: resolvedUsername ?? undefined,
      },
    );
  }

  // Extract avatar URL from stats
  const userStats = statsResult.stats.User;
  const avatar = userStats?.avatar as Record<string, string> | undefined;
  const resolvedAvatarUrl = avatar?.medium || avatar?.large || null;

  return {
    success: true,
    userId: resolvedUserId,
    username: resolvedUsername,
    avatarUrl: resolvedAvatarUrl,
    stats: statsResult.stats,
  };
}

/**
 * Fetches user data from the API.
 * Returns additional info about whether the user was not found (404).
 * @source
 */
async function fetchUserData(
  userId: string | null,
  username: string | null,
): Promise<
  | { userId: string; username: string | null; avatarUrl: string | null }
  | { error: string; notFound?: boolean }
> {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  else if (username) params.set("username", username);

  try {
    const res = await fetch(`/api/get-user?${params.toString()}`);
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      // Return notFound flag for 404 responses
      if (res.status === 404) {
        return { error: msg, notFound: true };
      }
      return { error: msg };
    }

    const data = payload as ReconstructedUserRecord;
    if (!data.userId) {
      return { error: "Invalid user data received" };
    }

    return {
      userId: String(data.userId),
      username: data.username || null,
      avatarUrl:
        data.stats?.User?.avatar?.medium ||
        data.stats?.User?.avatar?.large ||
        null,
    };
  } catch (err) {
    console.error("Error fetching user:", err);
    return {
      error:
        "Failed to fetch user data. Please check your connection and try again.",
    };
  }
}

/**
 * Fetches cards for a user.
 * @source
 */
async function fetchUserCards(
  userId: string,
): Promise<
  | { cards: ServerCardData[]; globalSettings?: ServerGlobalSettings }
  | { error: string }
> {
  try {
    const res = await fetch(`/api/get-cards?userId=${userId}`);
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    const data = payload as {
      cards?: ServerCardData[];
      globalSettings?: ServerGlobalSettings;
    };
    return {
      cards: data.cards || [],
      globalSettings: data.globalSettings,
    };
  } catch (err) {
    console.error("Error fetching cards:", err);
    return { error: "Failed to fetch cards" };
  }
}

/**
 * Groups card types by their group property.
 * @source
 */
function groupCardsByCategory() {
  const groups: Record<string, Array<(typeof statCardTypes)[0]>> = {};

  for (const cardType of statCardTypes) {
    if (!groups[cardType.group]) {
      groups[cardType.group] = [];
    }
    groups[cardType.group].push(cardType);
  }

  return groups;
}

/**
 * Main user page editor component.
 * Handles loading user data, displaying cards, and saving changes.
 * @returns JSX element.
 * @source
 */
export function UserPageEditor() {
  const searchParams = useSearchParams();
  const {
    userId,
    username,
    avatarUrl,
    isLoading,
    loadError,
    cardConfigs,
    isDirty,
    isSaving,
    saveError,
    lastSavedAt,
    setUserData,
    setLoading,
    setLoadError,
    initializeFromServerData,
    enableAllCards,
    disableAllCards,
    resetAllCardsToGlobal,
  } = useUserPageEditor();

  // Loading phase state for descriptive loading messages
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [isNewUser, setIsNewUser] = useState(false);
  const lastLoadedUserRef = useRef<string | null>(null);

  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"all" | "enabled" | "disabled">(
    "all",
  );
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      const groups = groupCardsByCategory();
      const groupNames = Object.keys(groups);
      const initial: Record<string, boolean> = {};
      for (const [index, name] of groupNames.entries()) {
        initial[name] = index === 0;
      }
      return initial;
    },
  );

  // Load user data on mount (re-runs when `searchParams` change)
  useEffect(() => {
    const rawUserIdParam = searchParams.get("userId");
    const rawUsernameParam = searchParams.get("username");

    let userIdParam = rawUserIdParam?.trim() ?? null;
    let usernameParam = rawUsernameParam?.trim() ?? null;

    if (!isValidUserId(userIdParam)) userIdParam = null;
    if (!isValidUsername(usernameParam)) usernameParam = null;

    const requestedId = `${userIdParam ?? ""}|${usernameParam ?? ""}`;

    // If we've already loaded this exact user, no-op.
    if (lastLoadedUserRef.current === requestedId) return;

    // Mark this identifier as being loaded to avoid duplicate runs (StrictMode)
    lastLoadedUserRef.current = requestedId;

    // Reset transient UI state for a fresh load
    setLoadError(null);
    setIsNewUser(false);

    const loadData = async () => {
      if (!userIdParam && !usernameParam) {
        if (rawUserIdParam || rawUsernameParam) {
          setLoadError(
            "Invalid user specified. Please check the username/user ID and try again.",
          );
        } else {
          setLoadError("No user specified. Please search for a user first.");
        }
        setLoadingPhase("error");
        // Clear the marker so future attempts can retry
        lastLoadedUserRef.current = null;
        return;
      }

      setLoading(true);
      setLoadingPhase("checking");

      // Step 1: Check if user exists in the database
      const userResult = await fetchUserData(userIdParam, usernameParam);

      // Step 2: If user not found (404), set up new user profile
      if ("error" in userResult && userResult.notFound) {
        setIsNewUser(true);

        const setupResult = await setupNewUser(
          userIdParam,
          usernameParam,
          setLoadingPhase,
        );

        if ("error" in setupResult) {
          setLoadError(setupResult.error);
          setLoadingPhase("error");
          // allow retry
          lastLoadedUserRef.current = null;
          return;
        }

        // Initialize the editor with the new user data
        setLoadingPhase("loading_cards");
        setUserData(
          setupResult.userId.toString(),
          setupResult.username,
          setupResult.avatarUrl,
        );

        // Initialize with empty cards since this is a new user
        initializeFromServerData(
          setupResult.userId.toString(),
          setupResult.username,
          setupResult.avatarUrl,
          [],
          undefined,
          statCardTypes.map((t) => t.id),
        );

        setLoadingPhase("complete");
        return;
      }

      // If there was a different error (not 404), show error
      if ("error" in userResult) {
        const errorDetails = getErrorDetails(userResult.error);
        trackUserActionError(
          "user_page_load",
          new Error(userResult.error),
          errorDetails.category,
        );
        setLoadError(userResult.error);
        setLoadingPhase("error");
        // allow retry
        lastLoadedUserRef.current = null;
        return;
      }

      // User exists - load their data normally
      setLoadingPhase("loading_cards");
      setUserData(userResult.userId, userResult.username, userResult.avatarUrl);

      // Fetch existing cards
      const cardsResult = await fetchUserCards(userResult.userId);
      if ("error" in cardsResult) {
        // Not a fatal error - user just has no cards yet
        initializeFromServerData(
          userResult.userId,
          userResult.username,
          userResult.avatarUrl,
          [],
          undefined,
          statCardTypes.map((t) => t.id),
        );
        setLoadingPhase("complete");
        return;
      }

      initializeFromServerData(
        userResult.userId,
        userResult.username,
        userResult.avatarUrl,
        cardsResult.cards,
        cardsResult.globalSettings,
        statCardTypes.map((t) => t.id),
      );
      setLoadingPhase("complete");
    };

    loadData().catch((err) => {
      console.error("Error loading user data:", err);
      // Clear marker so future attempts can retry
      lastLoadedUserRef.current = null;
      setLoadError(
        "Failed to fetch user data. Please check your connection and try again.",
      );
      setLoadingPhase("error");
    });
  }, [
    searchParams,
    setLoading,
    setLoadError,
    setUserData,
    initializeFromServerData,
  ]);

  // Group cards by category
  const cardGroups = useMemo(() => groupCardsByCategory(), []);

  // Auto-save hook
  const { saveNow } = useCardAutoSave({ debounceMs: 1500 });

  // Handle manual save (uses saveNow from auto-save hook)
  const handleSave = useCallback(async () => {
    await saveNow();
  }, [saveNow]);

  const normalizedQuery = query.trim().toLowerCase();

  const isCardEnabled = useCallback(
    (cardId: string) => Boolean(cardConfigs[cardId]?.enabled),
    [cardConfigs],
  );

  const groupTotals = useMemo(() => {
    const map: Record<string, { total: number; enabled: number }> = {};
    for (const [groupName, cards] of Object.entries(cardGroups)) {
      const enabledCount = cards.reduce(
        (acc, c) => acc + (cardConfigs[c.id]?.enabled ? 1 : 0),
        0,
      );
      map[groupName] = { total: cards.length, enabled: enabledCount };
    }
    return map;
  }, [cardConfigs, cardGroups]);

  const filteredGroups = useMemo(() => {
    const result: Record<string, Array<(typeof statCardTypes)[0]>> = {};

    const matchesVisibility = (cardId: string) => {
      const enabled = Boolean(cardConfigs[cardId]?.enabled);
      if (visibility === "enabled") return enabled;
      if (visibility === "disabled") return !enabled;
      return true;
    };

    const matchesQuery = (cardType: (typeof statCardTypes)[0]) => {
      if (!normalizedQuery) return true;
      const haystack = `${cardType.label} ${cardType.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    };

    for (const [groupName, cards] of Object.entries(cardGroups)) {
      if (selectedGroup !== "All" && selectedGroup !== groupName) continue;
      const filtered = cards.filter(
        (cardType) => matchesVisibility(cardType.id) && matchesQuery(cardType),
      );
      if (filtered.length > 0) {
        result[groupName] = filtered;
      }
    }

    return result;
  }, [cardGroups, cardConfigs, normalizedQuery, selectedGroup, visibility]);

  const visibleGroupNames = useMemo(
    () => Object.keys(filteredGroups),
    [filteredGroups],
  );

  useEffect(() => {
    if (selectedGroup === "All") return;
    setExpandedGroups((prev) => ({ ...prev, [selectedGroup]: true }));
  }, [selectedGroup]);

  useEffect(() => {
    if (!normalizedQuery) return;
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const groupName of visibleGroupNames) {
        next[groupName] = true;
      }
      return next;
    });
  }, [normalizedQuery, visibleGroupNames]);

  const expandAll = useCallback(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const groupName of Object.keys(cardGroups)) {
        next[groupName] = true;
      }
      return next;
    });
  }, [cardGroups]);

  const collapseAll = useCallback(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const groupName of Object.keys(cardGroups)) {
        next[groupName] = false;
      }
      return next;
    });
  }, [cardGroups]);

  const groupIcon = useCallback((groupName: string) => {
    if (groupName === "Core Stats") return <Layers className="h-5 w-5" />;
    if (groupName === "Anime Deep Dive")
      return <Clapperboard className="h-5 w-5" />;
    if (groupName === "Manga Deep Dive")
      return <BookOpen className="h-5 w-5" />;
    if (groupName === "Activity & Engagement")
      return <Activity className="h-5 w-5" />;
    if (groupName === "Library & Progress")
      return <Library className="h-5 w-5" />;
    if (groupName === "Advanced Analytics")
      return <BarChart3 className="h-5 w-5" />;
    return <LayoutGrid className="h-5 w-5" />;
  }, []);

  // Loading state - show descriptive messages based on loading phase
  if (isLoading) {
    const loadingMessage = LOADING_PHASE_MESSAGES[loadingPhase] || "Loading...";
    const isSettingUp =
      loadingPhase === "setting_up" ||
      loadingPhase === "fetching_anilist" ||
      loadingPhase === "saving";

    return (
      <div className="container relative z-10 mx-auto flex min-h-screen items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          {isSettingUp ? (
            <>
              {/* Enhanced loading UI for new user setup */}
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
                  <UserPlus className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <motion.div
                  className="absolute -inset-1 rounded-full border-2 border-blue-400/50"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                  Welcome to AniCards!
                </h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                  {loadingMessage}
                </p>
              </div>
              <LoadingSpinner size="md" />
            </>
          ) : (
            <LoadingSpinner size="lg" text={loadingMessage} />
          )}
        </motion.div>
      </div>
    );
  }

  // Error state
  if (loadError) {
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
            <p className="mb-6 text-slate-600 dark:text-slate-300">
              {loadError}
            </p>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg"
            >
              <Link href="/search">Search for User</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const saveState = { isSaving, isDirty, saveError, lastSavedAt };

  return (
    <div className="relative w-full overflow-hidden">
      <div className="container relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-10 lg:pt-14">
        <UserPageHeader
          userId={userId}
          username={username}
          avatarUrl={avatarUrl ?? undefined}
          saveState={saveState}
        />

        {/* Notices Section */}
        <div className="mx-auto mt-6 flex max-w-[80vw] flex-col gap-4">
          {/* Welcome Notice for New Users */}
          {isNewUser && (
            <div className="flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full max-w-[500px] rounded-xl border border-green-200/60 bg-gradient-to-r from-green-50/80 to-emerald-50/80 px-4 py-3 backdrop-blur-sm dark:border-green-800/40 dark:from-green-950/30 dark:to-emerald-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                    <UserPlus className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <span className="font-medium">Welcome to AniCards!</span>{" "}
                      Your profile is ready. Enable cards below and customize
                      them in Global Settings.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsNewUser(false)}
                    className="h-6 w-6 shrink-0 rounded-full p-0 text-green-600 hover:bg-green-100 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-900/50 dark:hover:text-green-200"
                    aria-label="Dismiss welcome notice"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            </div>
          )}

          <div className="flex flex-col justify-center gap-4 md:flex-row md:flex-wrap lg:flex-nowrap">
            {/* Daily Update Notice */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-[500px] flex-1 rounded-xl border border-blue-200/60 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 px-4 py-3 backdrop-blur-sm dark:border-blue-800/40 dark:from-blue-950/30 dark:to-indigo-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-medium">Set it and forget it!</span>{" "}
                  Stats update automatically every day. Your card URLs always
                  show the latest data.
                </p>
              </div>
            </motion.div>

            {/* Credits Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-[500px] flex-1 rounded-xl border border-pink-200/40 bg-gradient-to-r from-pink-50/80 via-purple-50/80 to-blue-50/80 px-4 py-3 backdrop-blur-sm dark:border-pink-800/30 dark:from-pink-950/30 dark:via-purple-950/30 dark:to-blue-950/30"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20">
                  <Heart className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-medium">Enjoying AniCards?</span> If
                    you find this project useful, consider crediting it in your
                    AniList bio. It helps others discover AniCards!
                  </p>
                </div>
                <a
                  href="https://anilist.co/user/Alpha49"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-pink-700 transition-all hover:border-pink-300 hover:bg-pink-50 dark:border-pink-800 dark:bg-slate-900/50 dark:text-pink-400 dark:hover:border-pink-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  @Alpha49
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {/* Main cards section */}
          <main className="mx-auto w-full max-w-[80vw] space-y-6">
            {/* Section header with integrated filters */}
            <div className="space-y-4">
              {/* Title row */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/25">
                    <LayoutGrid className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      Your Cards
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Toggle, customize, and preview your stat cards
                    </p>
                  </div>
                </div>

                {/* Global Settings Button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      size="default"
                      className="shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30"
                    >
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Global Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="overlay-scrollbar max-h-[85vh] max-w-4xl overflow-y-auto">
                    <GlobalSettingsPanel onSave={handleSave} />
                  </DialogContent>
                </Dialog>
              </div>

              {/* Filters toolbar */}
              <div
                className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/60"
                role="toolbar"
                aria-label="Card filters"
              >
                {/* Row 1: Search and Category */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="card-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search cards..."
                      className="h-10 rounded-xl border-slate-200/80 bg-white pl-9 text-sm dark:border-slate-600 dark:bg-slate-700/80"
                    />
                  </div>
                  <Select
                    value={selectedGroup}
                    onValueChange={setSelectedGroup}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200/80 bg-white text-sm dark:border-slate-600 dark:bg-slate-700/80 sm:w-48">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All categories</SelectItem>
                      {Object.keys(cardGroups).map((groupName) => (
                        <SelectItem key={groupName} value={groupName}>
                          {groupName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 2: Visibility and Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Visibility toggle */}
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-slate-50/80 p-1 dark:border-slate-600 dark:bg-slate-700/50">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={visibility === "all"}
                      className={cn(
                        "h-8 rounded-lg px-3 text-xs font-medium transition-all",
                        visibility === "all"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                      )}
                      onClick={() => setVisibility("all")}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={visibility === "enabled"}
                      className={cn(
                        "h-8 rounded-lg px-3 text-xs font-medium transition-all",
                        visibility === "enabled"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                      )}
                      onClick={() => setVisibility("enabled")}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Enabled
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={visibility === "disabled"}
                      className={cn(
                        "h-8 rounded-lg px-3 text-xs font-medium transition-all",
                        visibility === "disabled"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                      )}
                      onClick={() => setVisibility("disabled")}
                    >
                      <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                      Disabled
                    </Button>

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            data-testid="disabled-cards-info"
                            className={cn(
                              "ml-0.5 flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                              "text-slate-500 hover:bg-white hover:text-slate-700",
                              "dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-100",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                            )}
                            aria-label="Info about disabled cards"
                          >
                            <Info className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs text-xs leading-relaxed"
                          sideOffset={8}
                        >
                          <p>{DISABLED_CARD_INFO}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Quick actions group */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-slate-50/80 p-1 dark:border-slate-600 dark:bg-slate-700/50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                        onClick={expandAll}
                        title="Expand all categories"
                      >
                        <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Expand</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                        onClick={collapseAll}
                        title="Collapse all categories"
                      >
                        <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5 rotate-90" />
                        <span className="hidden sm:inline">Collapse</span>
                      </Button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                    {/* Desktop Bulk Actions */}
                    <div className="hidden items-center gap-2 sm:flex">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl border-emerald-200 bg-emerald-50/50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        onClick={enableAllCards}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Enable All
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl border-red-200 bg-red-50/50 px-3 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                        onClick={disableAllCards}
                      >
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                        Disable All
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={() => setIsResetDialogOpen(true)}
                        title="Reset all cards to use global settings"
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset All
                      </Button>
                    </div>

                    {/* Mobile Bulk Actions */}
                    <div className="sm:hidden">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 rounded-xl p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">More actions</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="end">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start text-emerald-600 dark:text-emerald-400"
                              onClick={enableAllCards}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Enable All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start text-red-600 dark:text-red-400"
                              onClick={disableAllCards}
                            >
                              <EyeOff className="mr-2 h-4 w-4" />
                              Disable All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start text-slate-600 dark:text-slate-400"
                              onClick={() => setIsResetDialogOpen(true)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reset All
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset All Cards AlertDialog */}
              <AlertDialog
                open={isResetDialogOpen}
                onOpenChange={setIsResetDialogOpen}
              >
                <AlertDialogContent className="border-red-200 dark:border-red-800">
                  <AlertDialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0">
                      <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <AlertDialogTitle className="text-red-900 dark:text-red-100">
                      Reset All Cards to Global Settings?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                      This action will reset <strong>all your cards</strong> to
                      use the global color and border settings. Any custom
                      per-card colors, borders, and advanced settings will be
                      removed.
                      <br />
                      <br />
                      <span className="font-medium text-red-600 dark:text-red-400">
                        This cannot be undone.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resetAllCardsToGlobal();
                        setIsResetDialogOpen(false);
                      }}
                      className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                    >
                      Reset All Cards
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {visibleGroupNames.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/50 bg-white/60 p-10 text-center shadow-xl backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/50">
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  No cards match your filters.
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Try clearing the search box or switching visibility.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVisibility("all")}
                  >
                    Show all
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(filteredGroups).map(
                  ([groupName, filteredCards], index) => {
                    const stats = groupTotals[groupName] ?? {
                      total: filteredCards.length,
                      enabled: filteredCards.filter((c) => isCardEnabled(c.id))
                        .length,
                    };

                    return (
                      <motion.div
                        key={groupName}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.04, 0.25) }}
                      >
                        <CardCategorySection
                          title={groupName}
                          icon={groupIcon(groupName)}
                          cardCount={stats.total}
                          enabledCount={stats.enabled}
                          expanded={expandedGroups[groupName] ?? true}
                          onExpandedChange={(next) =>
                            setExpandedGroups((prev) => ({
                              ...prev,
                              [groupName]: next,
                            }))
                          }
                          defaultExpanded={index === 0}
                        >
                          {filteredCards.map((cardType) => (
                            <CardTile
                              key={cardType.id}
                              cardId={cardType.id}
                              label={cardType.label}
                              variations={cardType.variations}
                              supportsStatusColors={STATUS_COLOR_CARDS.has(
                                cardType.id,
                              )}
                              supportsPiePercentages={PIE_PERCENTAGE_CARDS.has(
                                cardType.id,
                              )}
                              supportsFavorites={FAVORITES_CARDS.has(
                                cardType.id,
                              )}
                              isFavoritesGrid={cardType.id === "favoritesGrid"}
                            />
                          ))}
                        </CardCategorySection>
                      </motion.div>
                    );
                  },
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Bulk actions toolbar - appears when cards are selected */}
      <BulkActionsToolbar />
    </div>
  );
}
