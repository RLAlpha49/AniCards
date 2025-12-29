"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
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
import { UserHelpDialog } from "./UserHelpDialog";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import { CardCategorySection } from "./CardCategorySection";
import { CardTile } from "./CardTile";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import { DISABLED_CARD_INFO } from "@/lib/card-info-tooltips";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import { useCardAutoSave } from "@/hooks/useCardAutoSave";
import { cn } from "@/lib/utils";
import { useNewUserSetup } from "./hooks/useNewUserSetup";
import { useCardFiltering } from "./hooks/useCardFiltering";
import { useUserDataLoader } from "./hooks/useUserDataLoader";
import type { LoadingPhase } from "@/lib/types/loading";

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
    // store actions moved to hooks
    // setUserData, setLoading, setLoadError, initializeFromServerData,
    enableAllCards,
    disableAllCards,
    resetAllCardsToGlobal,
  } = useUserPageEditor();

  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"all" | "enabled" | "disabled">(
    "all",
  );
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // New-user setup hook
  const { isNewUser, setIsNewUser, cardsWarning, setCardsWarning } =
    useNewUserSetup();

  // Card filtering hook (manages grouping, filtering, visibility, expand/collapse)
  const {
    filteredGroups,
    cardGroups,
    groupTotals,
    visibleGroupNames,
    isCardEnabled,
    expandAll,
    collapseAll,
    expandedGroups,
    setGroupExpanded,
  } = useCardFiltering({
    cardConfigs,
    query,
    setQuery,
    visibility,
    setVisibility,
    selectedGroup,
    setSelectedGroup,
  });

  // Data loader hook manages the main load flow and loading phases
  const { loadingPhase } = useUserDataLoader();

  // Auto-save hook
  const { saveNow } = useCardAutoSave({ debounceMs: 1500 });

  // Keep resetting help dialog when search params change
  useEffect(() => {
    setIsHelpDialogOpen(false);
  }, [searchParams]);

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

  const saveState = useMemo(
    () => ({ isSaving, isDirty, saveError, lastSavedAt }),
    [isSaving, isDirty, saveError, lastSavedAt],
  );

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

  return (
    <div className="relative w-full overflow-hidden">
      <div className="container relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-10 lg:pt-14">
        <UserPageHeader
          userId={userId}
          username={username}
          avatarUrl={avatarUrl ?? undefined}
          saveState={saveState}
        />

        <UserHelpDialog
          open={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
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

          {/* Quick Start Callout (shown for new users) */}
          {isNewUser && (
            <div className="flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="w-full max-w-[700px] rounded-xl border border-slate-200/60 bg-white/70 px-4 py-4 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <Info
                      className="h-4 w-4 text-blue-700 dark:text-blue-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Quick start
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
                      <li>
                        Enable the cards you want below (you can always change
                        this later).
                      </li>
                      <li>
                        Open <strong>Global Settings</strong> to set your
                        default style.
                      </li>
                      <li>
                        Use each card’s actions to copy links/text or download.
                      </li>
                    </ul>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full rounded-xl sm:w-auto"
                        onClick={() => setIsHelpDialogOpen(true)}
                        aria-haspopup="dialog"
                      >
                        Learn more
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {cardsWarning && (
            <div className="flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="w-full max-w-[700px] rounded-xl border border-yellow-200/60 bg-gradient-to-r from-yellow-50/80 to-amber-50/80 px-4 py-3 backdrop-blur-sm dark:border-yellow-800/40 dark:from-yellow-950/30 dark:to-amber-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/50">
                    <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <span className="font-medium">
                        Problem loading saved cards:
                      </span>{" "}
                      {cardsWarning}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCardsWarning(null)}
                    className="h-6 w-6 shrink-0 rounded-full p-0 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-900/50 dark:hover:text-yellow-100"
                    aria-label="Dismiss card loading warning"
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

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full shrink-0 rounded-xl sm:w-auto"
                    onClick={() => setIsHelpDialogOpen(true)}
                    aria-haspopup="dialog"
                  >
                    <Info className="mr-2 h-4 w-4" aria-hidden="true" />
                    Help
                  </Button>

                  {/* Global Settings Button */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        size="default"
                        className="w-full shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 sm:w-auto"
                      >
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Global Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="overlay-scrollbar max-h-[85vh] max-w-4xl overflow-y-auto">
                      <GlobalSettingsPanel onSave={saveNow} />
                    </DialogContent>
                  </Dialog>
                </div>
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
                            setGroupExpanded(groupName, next)
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
