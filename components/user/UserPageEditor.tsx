"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
  RotateCcw,
  Undo2,
  Redo2,
  Info,
  UserPlus,
  MoreHorizontal,
  GripVertical,
  Save,
  Trash2,
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
import {
  CardCategorySection,
  type CardTileDragHandleProps,
} from "./CardCategorySection";
import { CardTile } from "./CardTile";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import { BulkConfirmDialog } from "./bulk/BulkConfirmDialog";
import { DISABLED_CARD_INFO } from "@/lib/card-info-tooltips";
import {
  buildLocalEditsPatch,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import { useCardAutoSave } from "@/hooks/useCardAutoSave";
import { useUserPageDraftBackup } from "@/hooks/useUserPageDraftBackup";
import {
  clearUserPageDraft,
  readUserPageDraft,
} from "@/lib/user-page-editor-draft";
import { cn } from "@/lib/utils";
import { useNewUserSetup } from "./hooks/useNewUserSetup";
import { useCardFiltering } from "./hooks/useCardFiltering";
import { useUserDataLoader } from "./hooks/useUserDataLoader";
import { BulkActionLiveRegion } from "./editor/BulkActionLiveRegion";
import { EditorNotices } from "./editor/EditorNotices";
import { useEditorTour } from "./editor/EditorTour";
import { ReorderModeHint } from "./editor/ReorderModeHint";
import type { LoadingPhase } from "@/lib/types/loading";
import { useShallow } from "zustand/react/shallow";

type TooltipTriggerMode = "enabled" | "disabled";

function getTooltipTriggerChild(mode: TooltipTriggerMode, child: ReactElement) {
  return mode === "disabled" ? (
    <span className="inline-flex">{child}</span>
  ) : (
    child
  );
}

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

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Core Stats": <Layers className="h-5 w-5" />,
  "Anime Deep Dive": <Clapperboard className="h-5 w-5" />,
  "Manga Deep Dive": <BookOpen className="h-5 w-5" />,
  "Activity & Engagement": <Activity className="h-5 w-5" />,
  "Library & Progress": <Library className="h-5 w-5" />,
  "Advanced Analytics": <BarChart3 className="h-5 w-5" />,
};
const DEFAULT_GROUP_ICON = <LayoutGrid className="h-5 w-5" />;

const VALID_VISIBILITY = new Set(["all", "enabled", "disabled"]);

type VisibilityFilter = "all" | "enabled" | "disabled";

function parseVisibilityParam(v: string | null): VisibilityFilter {
  return v && VALID_VISIBILITY.has(v) ? (v as VisibilityFilter) : "all";
}

type ReorderModeToggleProps = {
  isReorderMode: boolean;
  canEnterReorderMode: boolean;
  onToggle: () => void;
  dataTour?: string;
};

function ReorderModeToolbarToggle({
  isReorderMode,
  canEnterReorderMode,
  onToggle,
  dataTour,
}: Readonly<ReorderModeToggleProps>) {
  const isDisabled = !canEnterReorderMode && !isReorderMode;

  const button = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={isReorderMode}
      disabled={isDisabled}
      onClick={onToggle}
      data-tour={dataTour}
      className={cn(
        "h-9 rounded-xl px-3 text-xs font-medium",
        isReorderMode
          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/45"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
      )}
      title={
        canEnterReorderMode
          ? "Drag cards by the handle to reorder"
          : "Clear search and set visibility to All to reorder"
      }
    >
      <GripVertical className="mr-1.5 h-3.5 w-3.5" />
      {isReorderMode ? "Done" : "Reorder"}
    </Button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {isDisabled ? <span className="inline-flex">{button}</span> : button}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          className="max-w-xs text-xs leading-relaxed"
        >
          {canEnterReorderMode ? (
            <p>
              Drag cards by the handle to reorder within each category. Changes
              save automatically.
            </p>
          ) : (
            <p>
              Clear the search box and set visibility to <strong>All</strong> to
              reorder cards.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ReorderModeMenuToggle({
  isReorderMode,
  canEnterReorderMode,
  onToggle,
  dataTour,
}: Readonly<ReorderModeToggleProps>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start"
      aria-pressed={isReorderMode}
      disabled={!canEnterReorderMode && !isReorderMode}
      onClick={onToggle}
      data-tour={dataTour}
      title={
        canEnterReorderMode
          ? "Drag cards by the handle to reorder"
          : "Clear search and set visibility to All to reorder"
      }
    >
      <GripVertical className="mr-2 h-4 w-4" />
      {isReorderMode ? "Done reordering" : "Reorder"}
    </Button>
  );
}

function useStableCardEnabledById(): Record<string, boolean> {
  // Enabled-only view of card state.
  // Memoize the derived enabled map and preserve the same object reference
  // when no enabled values changed. This keeps filtering fast and prevents
  // unrelated per-card updates (variant/colors) from re-rendering the whole
  // editor by ensuring referential equality for the selector result.
  const enabledMapRef = useRef<Record<string, boolean> | null>(null);

  return useUserPageEditor(
    useShallow((s) => {
      const next: Record<string, boolean> = {};
      for (const [cardId, cfg] of Object.entries(s.cardConfigs)) {
        next[cardId] = Boolean(cfg.enabled);
      }

      const prev = enabledMapRef.current;
      if (prev) {
        const prevLen = Object.keys(prev).length;
        const nextLen = Object.keys(next).length;
        if (prevLen === nextLen) {
          for (const k in next) {
            if (prev[k] !== next[k]) {
              enabledMapRef.current = next;
              return next;
            }
          }
          return prev;
        }
      }

      enabledMapRef.current = next;
      return next;
    }),
  );
}

/**
 * Main user page editor component.
 * Handles loading user data, displaying cards, and saving changes.
 * @returns JSX element.
 * @source
 */
export function UserPageEditor() {
  // NOSONAR
  const searchParams = useSearchParams();
  const {
    userId,
    username,
    avatarUrl,
    isLoading,
    loadError,
    isDirty,
    isSaving,
    saveError,
    lastSavedAt,
    cardOrder,
    enableAllCards,
    disableAllCards,
    resetAllCardsToGlobal,
    undoBulk,
    redoBulk,
    bulkPastLength,
    bulkFutureLength,
    bulkLastMessage,
    reorderCardsInScope,
    discardChanges,
    applyLocalEditsPatch,
  } = useUserPageEditor(
    useShallow((s) => ({
      userId: s.userId,
      username: s.username,
      avatarUrl: s.avatarUrl,
      isLoading: s.isLoading,
      loadError: s.loadError,
      isDirty: s.isDirty,
      isSaving: s.isSaving,
      saveError: s.saveError,
      lastSavedAt: s.lastSavedAt,
      cardOrder: s.cardOrder,
      enableAllCards: s.enableAllCards,
      disableAllCards: s.disableAllCards,
      resetAllCardsToGlobal: s.resetAllCardsToGlobal,
      undoBulk: s.undoBulk,
      redoBulk: s.redoBulk,
      bulkPastLength: s.bulkPast.length,
      bulkFutureLength: s.bulkFuture.length,
      bulkLastMessage: s.bulkLastMessage,
      reorderCardsInScope: s.reorderCardsInScope,
      discardChanges: s.discardChanges,
      applyLocalEditsPatch: s.applyLocalEditsPatch,
    })),
  );
  const canUndoBulk = bulkPastLength > 0;
  const canRedoBulk = bulkFutureLength > 0;

  const cardEnabledById = useStableCardEnabledById();

  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const [draftRecord, setDraftRecord] =
    useState<ReturnType<typeof readUserPageDraft>>(null);
  const [isDraftNoticeDismissed, setIsDraftNoticeDismissed] = useState(false);

  const initialQuery = searchParams.get("q") ?? "";
  const initialVisibility = parseVisibilityParam(
    searchParams.get("visibility"),
  );
  const initialGroup = searchParams.get("group") ?? "All";

  const [query, setQuery] = useState(initialQuery);
  const [visibility, setVisibility] =
    useState<VisibilityFilter>(initialVisibility);
  const [selectedGroup, setSelectedGroup] = useState<string>(initialGroup);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDisableAllDialogOpen, setIsDisableAllDialogOpen] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const canEnterReorderMode = useMemo(
    () => query.trim().length === 0 && visibility === "all",
    [query, visibility],
  );

  // Reordering with active filters is confusing (scope isn't the full category).
  // Auto-exit when the user applies filters.
  useEffect(() => {
    if (isReorderMode && !canEnterReorderMode) {
      setIsReorderMode(false);
    }
  }, [canEnterReorderMode, isReorderMode]);

  // New-user setup hook
  const { isNewUser, setIsNewUser, cardsWarning, setCardsWarning } =
    useNewUserSetup();

  const closeHelpDialog = useCallback(() => {
    setIsHelpDialogOpen(false);
  }, []);

  const { startTour } = useEditorTour({
    userId,
    isNewUser,
    setIsNewUser,
    closeHelpDialog,
  });

  // Card filtering hook (manages grouping, filtering, visibility, expand/collapse)
  const {
    filteredGroups,
    cardGroups,
    groupTotals,
    filteredGroupTotals,
    visibleGroupNames,
    isCardEnabled,
    expandAll,
    collapseAll,
    expandedGroups,
    setGroupExpanded,
    layoutVersion,
  } = useCardFiltering({
    cardEnabledById,
    cardOrder,
    query,
    visibility,
    selectedGroup,
  });

  // Data loader hook manages the main load flow and loading phases
  const { loadingPhase, reload } = useUserDataLoader();

  // Auto-save hook
  const { saveNow, saveConflict, clearSaveConflict } = useCardAutoSave({
    debounceMs: 1500,
  });

  useUserPageDraftBackup();

  const allCardIds = useMemo(() => {
    const ids: string[] = [];
    for (const cards of Object.values(cardGroups)) {
      for (const c of cards) ids.push(c.id);
    }
    return ids;
  }, [cardGroups]);

  const cardMetaById = useMemo(() => {
    const map = new Map<string, { label: string; group: string }>();
    for (const [groupName, cards] of Object.entries(cardGroups)) {
      for (const c of cards) {
        map.set(c.id, { label: c.label, group: groupName });
      }
    }
    return map;
  }, [cardGroups]);

  const enabledCardIds = useMemo(
    () => allCardIds.filter((id) => Boolean(cardEnabledById[id])),
    [allCardIds, cardEnabledById],
  );

  const allCardsPreviewItems = useMemo(
    () =>
      allCardIds.map((id) => {
        const meta = cardMetaById.get(id);
        return {
          cardId: id,
          label: meta?.label ?? id,
          group: meta?.group,
          enabled: Boolean(cardEnabledById[id]),
        };
      }),
    [allCardIds, cardEnabledById, cardMetaById],
  );

  const enabledCardsPreviewItems = useMemo(
    () =>
      enabledCardIds.map((id) => {
        const meta = cardMetaById.get(id);
        return {
          cardId: id,
          label: meta?.label ?? id,
          group: meta?.group,
          enabled: true,
        };
      }),
    [cardMetaById, enabledCardIds],
  );

  // Keep resetting help dialog when search params change
  useEffect(() => {
    setIsHelpDialogOpen(false);
  }, [searchParams]);

  // Sync state from URL search params when the URL changes (back/forward etc.)
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const v = parseVisibilityParam(searchParams.get("visibility"));
    const g = searchParams.get("group") ?? "All";

    if (q !== query) setQuery(q);
    if (v !== visibility) setVisibility(v);
    if (g !== selectedGroup) setSelectedGroup(g);
  }, [searchParams]);

  // Keyboard shortcuts (Ctrl/Cmd+F -> focus search, Ctrl/Cmd+E -> toggle enabled-only)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Ignore shortcuts while typing in inputs/textareas/contenteditable
      const target = e.target as Element | null;
      const isTypingTarget =
        !!target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target as HTMLElement).isContentEditable);

      if ((e.ctrlKey || e.metaKey) && key === "f") {
        if (isTypingTarget) return;
        e.preventDefault();
        searchRef.current?.focus();
      }

      if ((e.ctrlKey || e.metaKey) && key === "e") {
        if (isTypingTarget) return;
        e.preventDefault();
        setVisibility((prev) => (prev === "enabled" ? "all" : "enabled"));
      }

      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        saveNow();
      }
    };

    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [saveNow]);

  useEffect(() => {
    if (!userId || isLoading) return;
    if (isDirty) return;

    const next = readUserPageDraft(userId);
    setDraftRecord(next);
    setIsDraftNoticeDismissed(false);
  }, [userId, isLoading, isDirty]);

  const showDraftNotice =
    !isDraftNoticeDismissed && draftRecord != null && !isDirty;
  const showConflictNotice = saveConflict != null;

  const canSaveNow =
    Boolean(userId) && isDirty && !isSaving && !showConflictNotice;
  const canDiscardNow = isDirty && !isSaving;

  const handleResolveConflictKeepEdits = useCallback(async () => {
    if (!userId) return;

    const patch = buildLocalEditsPatch(useUserPageEditor.getState());

    try {
      await reload();
      clearSaveConflict();

      if (patch) {
        applyLocalEditsPatch(patch);
        await saveNow();
      }
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
      toast.error("Failed to reload latest changes", {
        description: "Please check your connection and try again.",
      });
    }
  }, [applyLocalEditsPatch, clearSaveConflict, reload, saveNow, userId]);

  const handleResolveConflictDiscardEdits = useCallback(async () => {
    try {
      await reload();
      clearSaveConflict();
    } catch (err) {
      console.error("Failed to reload latest changes:", err);
      toast.error("Failed to reload latest changes", {
        description: "Please check your connection and try again.",
      });
    }
  }, [clearSaveConflict, reload]);

  const handleRestoreDraft = useCallback(() => {
    if (!draftRecord) return;
    applyLocalEditsPatch(draftRecord.patch);
    setDraftRecord(null);
    toast.success("Draft restored");
  }, [applyLocalEditsPatch, draftRecord]);

  const handleDiscardDraft = useCallback(() => {
    if (!userId) return;
    clearUserPageDraft(userId);
    setDraftRecord(null);
    toast.success("Draft discarded");
  }, [userId]);

  const handleDiscardChanges = useCallback(() => {
    try {
      discardChanges();
      clearSaveConflict();
      if (userId) clearUserPageDraft(userId);
      setDraftRecord(null);
      setIsDiscardDialogOpen(false);
      toast.success("Changes discarded");
    } catch (err) {
      console.error("Failed to discard changes:", err);
      toast.error("Failed to discard changes");
    }
  }, [discardChanges, clearSaveConflict, userId]);

  const router = useRouter();
  const pathname = usePathname();

  // Persist filter state to the URL for shareable views (debounced to avoid spam)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(globalThis.location.search);

      if (query) params.set("q", query);
      else params.delete("q");

      if (visibility && visibility !== "all")
        params.set("visibility", visibility);
      else params.delete("visibility");

      if (selectedGroup && selectedGroup !== "All")
        params.set("group", selectedGroup);
      else params.delete("group");

      const search = params.toString();
      const url = search ? `${pathname}?${search}` : pathname;
      router.replace(url);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, visibility, selectedGroup, router, pathname]);

  const clearAllFilters = useCallback(() => {
    setQuery("");
    setVisibility("all");
    setSelectedGroup("All");
  }, []);

  const activeFilterCount = useMemo(
    () =>
      (query ? 1 : 0) +
      (visibility === "all" ? 0 : 1) +
      (selectedGroup === "All" ? 0 : 1),
    [query, visibility, selectedGroup],
  );

  const groupIcon = useCallback(
    (groupName: string) => GROUP_ICONS[groupName] ?? DEFAULT_GROUP_ICON,
    [],
  );

  const groupNames = useMemo(() => Object.keys(cardGroups), [cardGroups]);

  const handleExpandedChange = useCallback(
    (groupName: string, next: boolean) => {
      setGroupExpanded(groupName, next);
    },
    [setGroupExpanded],
  );

  type RenderableCardType = {
    id: string;
    label: string;
    variations: Array<{ id: string; label: string }>;
  };

  const renderCardTile = useCallback(
    (
      cardType: RenderableCardType,
      _index: number,
      ctx?: {
        dragHandleProps?: CardTileDragHandleProps;
        isDragging?: boolean;
      },
    ) => (
      <CardTile
        cardId={cardType.id}
        label={cardType.label}
        variations={cardType.variations}
        supportsStatusColors={STATUS_COLOR_CARDS.has(cardType.id)}
        supportsPiePercentages={PIE_PERCENTAGE_CARDS.has(cardType.id)}
        supportsFavorites={FAVORITES_CARDS.has(cardType.id)}
        isFavoritesGrid={cardType.id === "favoritesGrid"}
        dragHandleProps={isReorderMode ? ctx?.dragHandleProps : undefined}
        isDragging={isReorderMode ? ctx?.isDragging : false}
      />
    ),
    [isReorderMode],
  );

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
          onStartTour={startTour}
        />

        <EditorNotices
          showConflictNotice={showConflictNotice}
          onResolveConflictKeepEdits={handleResolveConflictKeepEdits}
          onResolveConflictDiscardEdits={handleResolveConflictDiscardEdits}
          showDraftNotice={showDraftNotice}
          onRestoreDraft={handleRestoreDraft}
          onDiscardDraft={handleDiscardDraft}
          onDismissDraftNotice={() => setIsDraftNoticeDismissed(true)}
          isNewUser={isNewUser}
          onDismissNewUser={() => setIsNewUser(false)}
          onOpenHelp={() => setIsHelpDialogOpen(true)}
          onStartTour={startTour}
          cardsWarning={cardsWarning}
          onDismissCardsWarning={() => setCardsWarning(null)}
        />

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
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {getTooltipTriggerChild(
                          canSaveNow ? "enabled" : "disabled",
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full shrink-0 rounded-xl sm:w-auto"
                            onClick={() => saveNow()}
                            disabled={!canSaveNow}
                            aria-keyshortcuts="Control+S Meta+S"
                            data-tour="save-button"
                          >
                            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                            Save
                          </Button>,
                        )}
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={8}
                        className="max-w-xs text-xs leading-relaxed"
                      >
                        <p>
                          Save your changes now. Autosave runs automatically,
                          but Ctrl/Cmd+S is always available.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {getTooltipTriggerChild(
                          canDiscardNow ? "enabled" : "disabled",
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full shrink-0 rounded-xl border-red-200 bg-red-50/40 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 sm:w-auto"
                            onClick={() => setIsDiscardDialogOpen(true)}
                            disabled={!canDiscardNow}
                          >
                            <Trash2
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            Discard
                          </Button>,
                        )}
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={8}
                        className="max-w-xs text-xs leading-relaxed"
                      >
                        <p>
                          Discard unsaved changes and revert to your last loaded
                          state.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full shrink-0 rounded-xl sm:w-auto"
                    onClick={() => setIsHelpDialogOpen(true)}
                    aria-haspopup="dialog"
                    data-tour="help-button"
                  >
                    <Info className="mr-2 h-4 w-4" aria-hidden="true" />
                    Help
                  </Button>
                  {/* Global Settings Button */}
                  <Dialog>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              size="default"
                              className="w-full shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 sm:w-auto"
                              data-tour="global-settings"
                            >
                              <SlidersHorizontal className="mr-2 h-4 w-4" />
                              Global Settings
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          sideOffset={8}
                          className="max-w-xs text-xs leading-relaxed"
                        >
                          <p>
                            Set your default look (colors, borders, and more).
                            Individual cards can still be customized.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DialogContent className="overlay-scrollbar max-h-[85vh] max-w-4xl overflow-y-auto">
                      <GlobalSettingsPanel onSave={saveNow} />
                    </DialogContent>
                  </Dialog>
                  <AlertDialog
                    open={isDiscardDialogOpen}
                    onOpenChange={setIsDiscardDialogOpen}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Discard unsaved changes?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will revert your editor to the last loaded/saved
                          state. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                          onClick={handleDiscardChanges}
                        >
                          Discard changes
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                      ref={searchRef}
                      id="card-search"
                      data-tour="card-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search cards... (Ctrl+F)"
                      aria-keyshortcuts="Control+F Meta+F"
                      className="h-10 rounded-xl border-slate-200/80 bg-white pl-9 pr-9 text-sm dark:border-slate-600 dark:bg-slate-700/80"
                    />

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2",
                              "flex h-7 w-7 items-center justify-center rounded-lg",
                              "text-slate-500 hover:bg-white hover:text-slate-700",
                              "dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-100",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                            )}
                            aria-label="Help: searching cards"
                          >
                            <Info className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="max-w-xs text-xs leading-relaxed"
                        >
                          <p>
                            Search cards by name. Use Ctrl/Cmd+F to focus the
                            search box from anywhere.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                      {groupNames.map((groupName) => (
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
                  <div
                    className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-slate-50/80 p-1 dark:border-slate-600 dark:bg-slate-700/50"
                    data-tour="visibility-toggle"
                  >
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

                  {/* Clear filters */}
                  <div className="ml-3 flex items-center gap-2">
                    {activeFilterCount > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="h-8 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                      >
                        Clear filters
                      </Button>
                    )}
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

                    <ReorderModeToolbarToggle
                      isReorderMode={isReorderMode}
                      canEnterReorderMode={canEnterReorderMode}
                      onToggle={() => setIsReorderMode((prev) => !prev)}
                      dataTour="reorder-toggle"
                    />

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                    {/* Desktop Bulk Actions */}
                    <div className="hidden items-center gap-2 sm:flex">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 rounded-xl p-0"
                        onClick={undoBulk}
                        disabled={!canUndoBulk}
                        title={
                          canUndoBulk
                            ? "Undo last bulk action"
                            : "Nothing to undo"
                        }
                      >
                        <Undo2 className="h-4 w-4" />
                        <span className="sr-only">Undo</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 rounded-xl p-0"
                        onClick={redoBulk}
                        disabled={!canRedoBulk}
                        title={
                          canRedoBulk
                            ? "Redo last bulk action"
                            : "Nothing to redo"
                        }
                      >
                        <Redo2 className="h-4 w-4" />
                        <span className="sr-only">Redo</span>
                      </Button>

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
                        onClick={() => {
                          if (enabledCardIds.length === 0) return;
                          setIsDisableAllDialogOpen(true);
                        }}
                        disabled={enabledCardIds.length === 0}
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
                            <ReorderModeMenuToggle
                              isReorderMode={isReorderMode}
                              canEnterReorderMode={canEnterReorderMode}
                              onToggle={() => setIsReorderMode((prev) => !prev)}
                              dataTour="reorder-toggle"
                            />

                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start"
                              onClick={undoBulk}
                              disabled={!canUndoBulk}
                            >
                              <Undo2 className="mr-2 h-4 w-4" />
                              Undo
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start"
                              onClick={redoBulk}
                              disabled={!canRedoBulk}
                            >
                              <Redo2 className="mr-2 h-4 w-4" />
                              Redo
                            </Button>

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
                              onClick={() => {
                                if (enabledCardIds.length === 0) return;
                                setIsDisableAllDialogOpen(true);
                              }}
                              disabled={enabledCardIds.length === 0}
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
              <BulkConfirmDialog
                open={isDisableAllDialogOpen}
                onOpenChange={setIsDisableAllDialogOpen}
                title="Disable all cards?"
                description={
                  <>
                    This will hide all currently enabled cards.
                    <br />
                    <br />
                    You can undo this afterwards.
                  </>
                }
                confirmLabel="Disable all"
                confirmDestructive
                previewItems={enabledCardsPreviewItems}
                totalAffected={enabledCardIds.length}
                onConfirm={() => {
                  disableAllCards();
                  setIsDisableAllDialogOpen(false);
                }}
              />

              <BulkConfirmDialog
                open={isResetDialogOpen}
                onOpenChange={setIsResetDialogOpen}
                title="Reset all cards to global settings?"
                description={
                  <>
                    This will reset <strong>all your cards</strong> to use the
                    global color, border, and advanced settings. Any custom
                    per-card colors, borders, and advanced settings will be
                    removed.
                    <br />
                    <br />
                    You can undo this afterwards.
                  </>
                }
                confirmLabel="Reset all"
                confirmDestructive
                previewItems={allCardsPreviewItems}
                totalAffected={allCardIds.length}
                onConfirm={() => {
                  resetAllCardsToGlobal();
                  setIsResetDialogOpen(false);
                }}
              />

              <BulkActionLiveRegion message={bulkLastMessage} />
              <ReorderModeHint isVisible={isReorderMode} />
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

                  {activeFilterCount > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearAllFilters}
                    >
                      Clear all filters
                    </Button>
                  )}

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
              <div className="space-y-6" data-tour="card-groups">
                {Object.entries(filteredGroups).map(
                  ([groupName, filteredCards], index) => {
                    const stats = filteredGroupTotals[groupName] ??
                      groupTotals[groupName] ?? {
                        total: filteredCards.length,
                        enabled: filteredCards.filter((c) =>
                          isCardEnabled(c.id),
                        ).length,
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
                            handleExpandedChange(groupName, next)
                          }
                          defaultExpanded={index === 0}
                          cards={filteredCards}
                          renderCard={renderCardTile}
                          getCardKey={(c) => c.id}
                          scrollMarginKey={layoutVersion}
                          reorderable={isReorderMode}
                          onReorder={({ activeId, overId, scopeIds }) => {
                            reorderCardsInScope({ activeId, overId, scopeIds });
                          }}
                        />
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
