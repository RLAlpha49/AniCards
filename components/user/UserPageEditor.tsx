"use client";

// Composes the user-page editor shell: data loading, autosave/draft recovery,
// keyboard shortcuts, filtering, and bulk actions all meet here so individual
// card tiles can stay focused on per-card rendering and controls.

import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowUp,
  BarChart3,
  BookOpen,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  ChevronsUpDown,
  Clapperboard,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Layers,
  LayoutGrid,
  Library,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  Undo2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { shallow as shallowEqual } from "zustand/shallow";

import { LoadingSpinner } from "@/components/LoadingSpinner";
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
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
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
import { useCardAutoSave } from "@/hooks/useCardAutoSave";
import { useUserPageDraftBackup } from "@/hooks/useUserPageDraftBackup";
import { DISABLED_CARD_INFO } from "@/lib/card-info-tooltips";
import { statCardTypes } from "@/lib/card-types";
import {
  buildLocalEditsPatch,
  isCardCustomized,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import type { LoadingPhase } from "@/lib/types/loading";
import {
  clearUserPageDraft,
  readUserPageDraft,
} from "@/lib/user-page-editor-draft";
import { cn } from "@/lib/utils";

import { BulkConfirmDialog } from "./bulk/BulkConfirmDialog";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import {
  CardCategorySection,
  type CardTileDragHandleProps,
} from "./CardCategorySection";
import { CardTile } from "./CardTile";
import { CommandPalette, type CommandPaletteCommand } from "./CommandPalette";
import { BulkActionLiveRegion } from "./editor/BulkActionLiveRegion";
import { EditorNotices } from "./editor/EditorNotices";
import { useEditorTour } from "./editor/EditorTour";
import { ReorderModeHint } from "./editor/ReorderModeHint";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import { CustomFilter, useCardFiltering } from "./hooks/useCardFiltering";
import { useNewUserSetup } from "./hooks/useNewUserSetup";
import { useUserDataLoader } from "./hooks/useUserDataLoader";
import { UserHelpDialog } from "./UserHelpDialog";
import { UserPageHeader } from "./UserPageHeader";

type TooltipTriggerMode = "enabled" | "disabled";

function getTooltipTriggerChild(mode: TooltipTriggerMode, child: ReactElement) {
  return mode === "disabled" ? (
    <span className="inline-flex">{child}</span>
  ) : (
    child
  );
}

function ShortcutHint({ children }: Readonly<{ children: string }>) {
  return (
    <kbd className="
      ml-2 inline-flex items-center border border-primary-foreground/25 bg-primary-foreground/10
      px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground
    ">
      {children}
    </kbd>
  );
}

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

function UserPageEditorLoadingScreen(
  props: Readonly<{
    loadingPhase: LoadingPhase;
    expectedCardCount?: number;
  }>,
) {
  const loadingMessage = useMemo(() => {
    if (props.loadingPhase === "loading_cards" && props.expectedCardCount) {
      return `Loading ${props.expectedCardCount} cards...`;
    }
    return LOADING_PHASE_MESSAGES[props.loadingPhase] || "Loading...";
  }, [props.expectedCardCount, props.loadingPhase]);
  const isSettingUp =
    props.loadingPhase === "setting_up" ||
    props.loadingPhase === "fetching_anilist" ||
    props.loadingPhase === "saving";

  return (
    <div className="
      relative z-10 container mx-auto flex min-h-screen items-center justify-center px-4
    ">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        {isSettingUp ? (
          <>
            <div className="relative">
              <div className="
                flex size-20 items-center justify-center rounded-full bg-linear-to-br from-gold/15
                to-amber-100
                dark:from-gold/10 dark:to-amber-900/20
              ">
                <UserPlus className="size-10 text-gold dark:text-gold" />
              </div>
              <motion.div
                className="absolute -inset-1 rounded-full border-2 border-gold/50"
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
            <div className="text-center">
              <h2 className="font-display text-xl text-foreground">
                Welcome to AniCards!
              </h2>
              <p className="mt-2 font-body-serif text-muted-foreground">
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

function UserPageEditorErrorScreen(props: Readonly<{ loadError: string }>) {
  return (
    <div className="
      relative z-10 container mx-auto flex min-h-screen items-center justify-center px-4
    ">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="
          relative border-2 border-gold/20 bg-background/80 p-8 text-center shadow-2xl
          backdrop-blur-xl
          dark:border-gold/15
        ">
          <div className="
            pointer-events-none absolute top-0 left-0 size-4 border-t-2 border-l-2 border-gold
          " />
          <div className="
            pointer-events-none absolute right-0 bottom-0 size-4 border-r-2 border-b-2 border-gold
          " />
          <div className="
            mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-red-100
            dark:bg-red-900/30
          ">
            <AlertCircle className="size-10 text-red-500" />
          </div>
          <h1 className="mb-3 font-display text-2xl text-foreground">
            Something Went Wrong
          </h1>
          <p className="mb-6 font-body-serif text-muted-foreground">
            {props.loadError}
          </p>
          <Button
            asChild
            className="
              bg-linear-to-r from-gold via-amber-500 to-gold-dim text-primary-foreground shadow-lg
              shadow-gold/20
            "
          >
            <Link href="/search">Search for User</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

const STATUS_COLOR_CARDS = new Set([
  "animeStatusDistribution",
  "mangaStatusDistribution",
]);

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

const FAVORITES_CARDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Core Stats": <Layers className="size-5" />,
  "Anime Deep Dive": <Clapperboard className="size-5" />,
  "Manga Deep Dive": <BookOpen className="size-5" />,
  "Activity & Engagement": <Activity className="size-5" />,
  "Library & Progress": <Library className="size-5" />,
  "Advanced Analytics": <BarChart3 className="size-5" />,
};
const DEFAULT_GROUP_ICON = <LayoutGrid className="size-5" />;

const VALID_VISIBILITY = new Set(["all", "enabled", "disabled"]);

type VisibilityFilter = "all" | "enabled" | "disabled";

function parseVisibilityParam(v: string | null): VisibilityFilter {
  return v && VALID_VISIBILITY.has(v) ? (v as VisibilityFilter) : "all";
}

type SearchParamsLike = { get: (key: string) => string | null };

function syncFiltersFromSearchParams(opts: {
  searchParams: SearchParamsLike;
  query: string;
  visibility: VisibilityFilter;
  selectedGroup: string;
  setQuery: (v: string) => void;
  setVisibility: (v: VisibilityFilter) => void;
  setSelectedGroup: (v: string) => void;
}) {
  const q = opts.searchParams.get("q") ?? "";
  const v = parseVisibilityParam(opts.searchParams.get("visibility"));
  const g = opts.searchParams.get("group") ?? "All";

  if (q !== opts.query) opts.setQuery(q);
  if (v !== opts.visibility) opts.setVisibility(v);
  if (g !== opts.selectedGroup) opts.setSelectedGroup(g);
}

function buildEditorUrl(opts: {
  pathname: string;
  currentSearch: string;
  query: string;
  visibility: VisibilityFilter;
  selectedGroup: string;
}) {
  const params = new URLSearchParams(opts.currentSearch);

  if (opts.query) params.set("q", opts.query);
  else params.delete("q");

  if (opts.visibility && opts.visibility !== "all") {
    params.set("visibility", opts.visibility);
  } else {
    params.delete("visibility");
  }

  if (opts.selectedGroup && opts.selectedGroup !== "All") {
    params.set("group", opts.selectedGroup);
  } else {
    params.delete("group");
  }

  const search = params.toString();
  return search ? `${opts.pathname}?${search}` : opts.pathname;
}

function useUserPageEditorCommandPalette(opts: {
  userId: string | null;
  visibility: VisibilityFilter;
  setVisibility: React.Dispatch<React.SetStateAction<VisibilityFilter>>;
  searchRef: React.RefObject<HTMLInputElement | null>;
  selectAllEnabled: () => void;
  deselectAll: () => void;
  toggleTheme: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  exportSettings: () => void;
  canSaveNow: boolean;
  canDiscardNow: boolean;
  saveNow: () => void | Promise<void>;
  startTour: () => void;
  openGlobalSettings: () => void;
  openDiscardDialog: () => void;
  openHelpDialog: () => void;
}): {
  recentActionsStorageKey: string;
  commandPaletteCommands: CommandPaletteCommand[];
} {
  const {
    userId,
    visibility,
    setVisibility,
    searchRef,
    selectAllEnabled,
    deselectAll,
    toggleTheme,
    expandAll,
    collapseAll,
    exportSettings,
    canSaveNow,
    canDiscardNow,
    saveNow,
    startTour,
    openGlobalSettings,
    openDiscardDialog,
    openHelpDialog,
  } = opts;

  const recentActionsStorageKey = useMemo(
    () =>
      `anicards:user-page-editor:command-palette-recent:v1:${userId ?? "anon"}`,
    [userId],
  );

  const toggleVisibilityFilter = useCallback(() => {
    setVisibility((prev) => {
      if (prev === "all") return "enabled";
      if (prev === "enabled") return "disabled";
      return "all";
    });
  }, [setVisibility]);

  const openBulkActions = useCallback(() => {
    const hasSelection = useUserPageEditor.getState().selectedCardIds.size > 0;

    if (!hasSelection) {
      selectAllEnabled();
      toast("Selected all enabled cards", {
        id: "bulk-actions-opened",
        description:
          "Use the bulk toolbar at the bottom of the screen to copy/download/edit.",
      });
      return;
    }

    toast("Bulk actions are ready", {
      id: "bulk-actions-ready",
      description:
        "Use the bulk toolbar at the bottom of the screen to copy/download/edit.",
    });
  }, [selectAllEnabled]);

  const commandPaletteCommands = useMemo<CommandPaletteCommand[]>(
    () => [
      {
        id: "search-cards",
        label: "Search cards",
        description: "Focus the card search box",
        keywords: ["find", "filter", "query"],
        group: "editor",
        shortcutHint: "Ctrl/Cmd+F",
        icon: <Search className="size-4" aria-hidden="true" />,
        run: () => {
          searchRef.current?.focus();
        },
      },
      {
        id: "toggle-visibility",
        label: "Toggle visibility filter",
        description: `Currently: ${visibility}`,
        keywords: ["enabled", "disabled", "all", "show"],
        group: "editor",
        icon:
          visibility === "disabled" ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          ),
        run: toggleVisibilityFilter,
      },
      {
        id: "open-settings",
        label: "Open global settings",
        description: "Edit default colors, borders, and advanced options",
        keywords: ["preferences", "theme", "defaults"],
        group: "editor",
        icon: <SlidersHorizontal className="size-4" aria-hidden="true" />,
        run: openGlobalSettings,
      },
      {
        id: "save",
        label: "Save changes",
        description: canSaveNow
          ? "Save your current edits"
          : "No changes to save",
        keywords: ["commit", "store", "persist"],
        group: "editor",
        shortcutHint: "Ctrl/Cmd+S",
        icon: <Save className="size-4" aria-hidden="true" />,
        disabled: !canSaveNow,
        run: saveNow,
      },
      {
        id: "discard",
        label: "Discard changes",
        description: canDiscardNow
          ? "Revert to last loaded/saved state"
          : "Nothing to discard",
        keywords: ["revert", "reset", "undo all"],
        group: "editor",
        icon: <Trash2 className="size-4" aria-hidden="true" />,
        disabled: !canDiscardNow,
        run: openDiscardDialog,
      },
      {
        id: "bulk-actions",
        label: "Bulk actions",
        description: "Open the bulk actions toolbar",
        keywords: ["multi", "select", "download", "copy", "bulk edit"],
        group: "bulk",
        icon: <Layers className="size-4" aria-hidden="true" />,
        run: openBulkActions,
      },
      {
        id: "help",
        label: "Help",
        description: "View shortcuts and tips",
        keywords: ["shortcuts", "faq", "guide"],
        group: "help",
        shortcutHint: "Ctrl/Cmd+H",
        icon: <Info className="size-4" aria-hidden="true" />,
        run: openHelpDialog,
      },
      {
        id: "start-tour",
        label: "Start tour",
        description: "Guided walkthrough of the editor",
        keywords: ["tutorial", "onboarding", "walkthrough"],
        group: "help",
        run: startTour,
      },
      {
        id: "select-all",
        label: "Select all enabled cards",
        description: "Select all enabled cards for bulk operations",
        keywords: ["check", "mark", "all"],
        group: "bulk",
        shortcutHint: "Ctrl/Cmd+A",
        icon: <CheckSquare className="size-4" aria-hidden="true" />,
        run: selectAllEnabled,
      },
      {
        id: "deselect-all",
        label: "Deselect all cards",
        description: "Clear the current selection",
        keywords: ["uncheck", "clear", "none"],
        group: "bulk",
        icon: <Square className="size-4" aria-hidden="true" />,
        run: deselectAll,
      },
      {
        id: "toggle-theme",
        label: "Toggle dark/light mode",
        description: "Switch between dark and light appearance",
        keywords: ["dark", "light", "theme", "mode", "appearance"],
        group: "editor",
        icon: <Sun className="size-4" aria-hidden="true" />,
        run: toggleTheme,
      },
      {
        id: "expand-all",
        label: "Expand all card categories",
        description: "Open every category section",
        keywords: ["open", "unfold", "show all"],
        group: "editor",
        icon: <ChevronsDown className="size-4" aria-hidden="true" />,
        run: expandAll,
      },
      {
        id: "collapse-all",
        label: "Collapse all card categories",
        description: "Close every category section",
        keywords: ["close", "fold", "hide all"],
        group: "editor",
        icon: <ChevronsUp className="size-4" aria-hidden="true" />,
        run: collapseAll,
      },
      {
        id: "export-settings",
        label: "Export settings as JSON",
        description: "Download a backup of all settings and templates",
        keywords: ["backup", "download", "json", "export"],
        group: "editor",
        icon: <Download className="size-4" aria-hidden="true" />,
        run: exportSettings,
      },
      {
        id: "scroll-to-top",
        label: "Scroll to top",
        description: "Scroll the page to the top",
        keywords: ["top", "beginning"],
        group: "editor",
        icon: <ArrowUp className="size-4" aria-hidden="true" />,
        run: () => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      },
    ],
    [
      openBulkActions,
      canDiscardNow,
      canSaveNow,
      openDiscardDialog,
      openGlobalSettings,
      openHelpDialog,
      saveNow,
      searchRef,
      startTour,
      visibility,
      toggleVisibilityFilter,
      selectAllEnabled,
      deselectAll,
      toggleTheme,
      expandAll,
      collapseAll,
      exportSettings,
    ],
  );

  return { recentActionsStorageKey, commandPaletteCommands };
}

function useUserPageEditorKeyboardShortcuts(opts: {
  canEnterReorderMode: boolean;
  isReorderMode: boolean;
  setIsReorderMode: React.Dispatch<React.SetStateAction<boolean>>;
  clearSelection: () => void;
  selectAllEnabled: () => void;
  visibility: VisibilityFilter;
  setVisibility: React.Dispatch<React.SetStateAction<VisibilityFilter>>;
  saveNow: () => void | Promise<void>;
  setIsHelpDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchRef: React.RefObject<HTMLInputElement | null>;
  groupFilterTriggerId: string;
}): void {
  useEffect(() => {
    const isTypingInField = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target as HTMLElement).isContentEditable
      );
    };

    const hasAnyOpenDialog = () =>
      Boolean(
        globalThis.document?.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]',
        ),
      );

    const handleEscape = (e: KeyboardEvent, key: string) => {
      if (key !== "escape") return false;
      if (isTypingInField(e.target) || hasAnyOpenDialog()) return true;

      const hasSelection =
        useUserPageEditor.getState().selectedCardIds.size > 0;
      if (!hasSelection && !opts.isReorderMode) return true;

      e.preventDefault();
      if (hasSelection) {
        opts.clearSelection();
      } else if (opts.isReorderMode) {
        opts.setIsReorderMode(false);
      }
      return true;
    };
    const handleFindShortcut = (e: KeyboardEvent) => {
      e.preventDefault();

      if (e.shiftKey) {
        const el = globalThis.document?.getElementById(
          opts.groupFilterTriggerId,
        ) as HTMLButtonElement | null;
        el?.focus();
      } else {
        opts.searchRef.current?.focus();
      }
    };

    const handleHelpShortcut = (e: KeyboardEvent) => {
      e.preventDefault();
      opts.setIsHelpDialogOpen(true);
    };

    const handleReorderShortcut = (e: KeyboardEvent) => {
      // Allow exiting even if filters have been applied.
      // If reordering isn't available, block the browser bookmark shortcut
      // and provide a gentle hint.
      if (!opts.isReorderMode && !opts.canEnterReorderMode) {
        e.preventDefault();
        toast("Reorder mode is disabled while filters are active.", {
          id: "reorder-mode-unavailable",
          description:
            "Clear the search box and set visibility to All to reorder.",
        });
        return;
      }

      e.preventDefault();
      const next = opts.isReorderMode ? false : opts.canEnterReorderMode;
      opts.setIsReorderMode(next);
    };

    const handleSelectAllShortcut = (e: KeyboardEvent) => {
      e.preventDefault();
      opts.selectAllEnabled();
    };

    const handleEnabledOnlyShortcut = (e: KeyboardEvent) => {
      e.preventDefault();
      opts.setVisibility(opts.visibility === "enabled" ? "all" : "enabled");
    };

    const handleSaveShortcut = (e: KeyboardEvent) => {
      e.preventDefault();
      opts.saveNow();
    };

    const modChordHandlers: Record<string, (e: KeyboardEvent) => void> = {
      h: handleHelpShortcut,
      d: handleReorderShortcut,
      a: handleSelectAllShortcut,
      e: handleEnabledOnlyShortcut,
      s: handleSaveShortcut,
    };

    const handleModChord = (e: KeyboardEvent, key: string) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod || e.altKey) return false;

      // Ctrl/Cmd+K is commonly used for a command palette. Prevent the browser
      // default even when focused in an input.
      if (!e.shiftKey && key === "k") {
        e.preventDefault();
        if (!hasAnyOpenDialog()) {
          opts.setIsCommandPaletteOpen(true);
        }
        return true;
      }

      // Don't allow browser-level defaults for shortcuts we advertise.
      // (e.g., Ctrl/Cmd+D = bookmark, Ctrl/Cmd+H = history, Ctrl/Cmd+S = save page)
      const shouldBlockBrowserDefault =
        !e.shiftKey && (key === "d" || key === "h" || key === "s");

      if (hasAnyOpenDialog()) {
        if (shouldBlockBrowserDefault) {
          e.preventDefault();
        }
        return true;
      }

      if (isTypingInField(e.target)) {
        if (shouldBlockBrowserDefault) {
          e.preventDefault();
        }
        return true;
      }

      if (key === "f") {
        handleFindShortcut(e);
        return true;
      }
      if (e.shiftKey) return false;

      const action = modChordHandlers[key];
      if (!action) return false;
      action(e);
      return true;
    };

    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;

      const key = e.key.toLowerCase();
      if (handleEscape(e, key)) return;
      handleModChord(e, key);
    };

    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [
    opts.canEnterReorderMode,
    opts.clearSelection,
    opts.groupFilterTriggerId,
    opts.isReorderMode,
    opts.saveNow,
    opts.searchRef,
    opts.selectAllEnabled,
    opts.setIsCommandPaletteOpen,
    opts.setIsHelpDialogOpen,
    opts.setIsReorderMode,
    opts.setVisibility,
    opts.visibility,
  ]);
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
      aria-keyshortcuts="Control+D Meta+D"
      disabled={isDisabled}
      onClick={onToggle}
      data-tour={dataTour}
      className={cn(
        "h-9 px-3 text-xs font-medium",
        isReorderMode
          ? `
            border-gold/30 bg-gold/10 text-gold-dim
            hover:bg-gold/15
            dark:border-gold/25 dark:bg-gold/10 dark:text-gold
            dark:hover:bg-gold/15
          `
          : `
            border-gold/15 bg-background text-muted-foreground
            hover:bg-gold/5 hover:text-foreground
            dark:border-gold/10
          `,
      )}
      title={
        canEnterReorderMode
          ? "Drag cards by the handle to reorder (Ctrl/Cmd+D)"
          : "Clear search and set visibility to All to reorder"
      }
    >
      <GripVertical className="mr-1.5 size-3.5" />
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
          className="max-w-xs text-xs/relaxed"
        >
          {canEnterReorderMode ? (
            <p>
              Drag cards by the handle to reorder within each category. Changes
              save automatically.
              <ShortcutHint>Ctrl/Cmd+D</ShortcutHint>
              <ShortcutHint>Esc</ShortcutHint>
            </p>
          ) : (
            <p>
              Clear the search box and set visibility to <strong>All</strong> to
              reorder cards.
              <ShortcutHint>Ctrl/Cmd+D</ShortcutHint>
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
      aria-keyshortcuts="Control+D Meta+D"
      disabled={!canEnterReorderMode && !isReorderMode}
      onClick={onToggle}
      data-tour={dataTour}
      title={
        canEnterReorderMode
          ? "Drag cards by the handle to reorder (Ctrl/Cmd+D)"
          : "Clear search and set visibility to All to reorder"
      }
    >
      <GripVertical className="mr-2 size-4" />
      {isReorderMode ? "Done reordering" : "Reorder"}
    </Button>
  );
}

function useStableCardEnabledById(): Record<string, boolean> {
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
      if (prev && shallowEqual(prev, next)) {
        return prev;
      }

      enabledMapRef.current = next;
      return next;
    }),
  );
}

function useStableCardCustomizedById(): Record<string, boolean> {
  // Memoize the derived customized map and preserve the same object reference
  // when no customized values changed. This keeps filtering snappy and prevents
  // unrelated card updates from re-rendering the full editor.
  const customizedMapRef = useRef<Record<string, boolean> | null>(null);

  return useUserPageEditor(
    useShallow((s) => {
      const next: Record<string, boolean> = {};
      for (const [cardId, cfg] of Object.entries(s.cardConfigs)) {
        next[cardId] = isCardCustomized(cfg);
      }

      const prev = customizedMapRef.current;
      if (prev && shallowEqual(prev, next)) {
        return prev;
      }

      customizedMapRef.current = next;
      return next;
    }),
  );
}

export function UserPageEditor() {
  const expectedCardCount = statCardTypes.length;
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
    clearSelection,
    selectAllEnabled,
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
      clearSelection: s.clearSelection,
      selectAllEnabled: s.selectAllEnabled,
    })),
  );
  const canUndoBulk = bulkPastLength > 0;
  const canRedoBulk = bulkFutureLength > 0;

  const cardEnabledById = useStableCardEnabledById();
  const cardCustomizedById = useStableCardCustomizedById();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);

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
  const [customFilter, setCustomFilter] = useState<CustomFilter>("all");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDisableAllDialogOpen, setIsDisableAllDialogOpen] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const groupFilterTriggerId = "card-group-filter";

  const canEnterReorderMode = useMemo(
    () =>
      query.trim().length === 0 &&
      visibility === "all" &&
      customFilter === "all",
    [query, visibility, customFilter],
  );

  useEffect(() => {
    if (isReorderMode && !canEnterReorderMode) {
      setIsReorderMode(false);
    }
  }, [canEnterReorderMode, isReorderMode]);

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

  const {
    filteredGroups,
    cardGroups,
    groupTotals,
    filteredGroupTotals,
    visibleGroupNames,
    filteredCardCount,
    scopeCardCount,
    isCardEnabled,
    expandAll,
    collapseAll,
    expandedGroups,
    setGroupExpanded,
    layoutVersion,
  } = useCardFiltering({
    cardEnabledById,
    cardCustomizedById,
    cardOrder,
    query,
    visibility,
    selectedGroup,
    customFilter,
  });

  const { loadingPhase, reload } = useUserDataLoader();

  const {
    saveNow,
    saveConflict,
    clearSaveConflict,
    isAutoSaveQueued,
    autoSaveDueAt,
  } = useCardAutoSave({
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

  useEffect(() => {
    setIsHelpDialogOpen(false);
  }, [searchParams]);

  useEffect(() => {
    syncFiltersFromSearchParams({
      searchParams,
      query,
      visibility,
      selectedGroup,
      setQuery,
      setVisibility,
      setSelectedGroup,
    });
  }, [searchParams]);

  useUserPageEditorKeyboardShortcuts({
    canEnterReorderMode,
    isReorderMode,
    setIsReorderMode,
    clearSelection,
    selectAllEnabled,
    visibility,
    setVisibility,
    saveNow,
    setIsHelpDialogOpen,
    setIsCommandPaletteOpen,
    searchRef,
    groupFilterTriggerId,
  });

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

  const { setTheme, resolvedTheme } = useTheme();
  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleExportSettings = useCallback(() => {
    const state = useUserPageEditor.getState();
    const global = state.getGlobalSettingsSnapshot();
    const payload = {
      schemaVersion: 1,
      scope: "all",
      exportedAt: new Date().toISOString(),
      global,
      templates: state.settingsTemplates,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anicards-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Settings exported");
  }, []);

  const { recentActionsStorageKey, commandPaletteCommands } =
    useUserPageEditorCommandPalette({
      userId,
      visibility,
      setVisibility,
      searchRef,
      selectAllEnabled,
      deselectAll: clearSelection,
      toggleTheme: handleToggleTheme,
      expandAll,
      collapseAll,
      exportSettings: handleExportSettings,
      canSaveNow,
      canDiscardNow,
      saveNow,
      startTour,
      openGlobalSettings: () => setIsGlobalSettingsOpen(true),
      openDiscardDialog: () => setIsDiscardDialogOpen(true),
      openHelpDialog: () => setIsHelpDialogOpen(true),
    });

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
      const url = buildEditorUrl({
        pathname,
        currentSearch: globalThis.location.search,
        query,
        visibility,
        selectedGroup,
      });
      router.replace(url);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, visibility, selectedGroup, router, pathname]);

  const clearAllFilters = useCallback(() => {
    setQuery("");
    setVisibility("all");
    setSelectedGroup("All");
    setCustomFilter("all");
  }, []);

  const activeFilterCount = useMemo(
    () =>
      (query ? 1 : 0) +
      (visibility === "all" ? 0 : 1) +
      (selectedGroup === "All" ? 0 : 1) +
      (customFilter === "all" ? 0 : 1),
    [query, visibility, selectedGroup, customFilter],
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
    () => ({
      isSaving,
      isDirty,
      saveError,
      lastSavedAt,
      isAutoSaveQueued,
      autoSaveDueAt,
      hasConflict: saveConflict != null,
    }),
    [
      autoSaveDueAt,
      isAutoSaveQueued,
      isDirty,
      isSaving,
      lastSavedAt,
      saveConflict,
      saveError,
    ],
  );

  if (isLoading) {
    return (
      <UserPageEditorLoadingScreen
        loadingPhase={loadingPhase}
        expectedCardCount={expectedCardCount}
      />
    );
  }

  if (loadError) {
    return <UserPageEditorErrorScreen loadError={loadError} />;
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 container mx-auto max-w-5xl px-4 pt-10 pb-16 lg:pt-14">
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

        <CommandPalette
          open={isCommandPaletteOpen}
          onOpenChange={setIsCommandPaletteOpen}
          commands={commandPaletteCommands}
          recentStorageKey={recentActionsStorageKey}
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
          <main className="mx-auto w-full max-w-[80vw] space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-3"
            >
              <div className="mb-4 gold-ornament text-xs tracking-[0.3em] text-gold/50 uppercase">
                ✦
              </div>

              <div className="flex items-center gap-4">
                <div className="
                  flex size-12 items-center justify-center bg-linear-to-br from-gold via-amber-500
                  to-gold-dim shadow-lg shadow-gold/20
                ">
                  <LayoutGrid className="size-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="
                    font-display text-lg tracking-[0.15em] text-foreground uppercase
                    sm:text-xl
                  ">
                    Your Cards
                  </h2>
                  <p className="font-body-serif text-sm text-muted-foreground">
                    Toggle, customize, and preview your stat cards
                  </p>
                </div>
              </div>

              <div className="
                flex items-center justify-between border border-gold/20 bg-background/80 px-2.5
                py-1.5 backdrop-blur-sm
                dark:border-gold/15 dark:bg-background/60
              ">
                <div className="flex items-center gap-1.5">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {getTooltipTriggerChild(
                          (["disabled", "enabled"] as const)[
                            Number(canSaveNow)
                          ],
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 px-2 text-xs font-medium sm:px-3",
                              canSaveNow
                                ? "text-foreground hover:bg-gold/8"
                                : "text-muted-foreground",
                            )}
                            onClick={() => saveNow()}
                            disabled={!canSaveNow}
                            aria-label="Save changes"
                            aria-keyshortcuts="Control+S Meta+S"
                            data-tour="save-button"
                          >
                            <Save
                              className="size-4 sm:mr-1.5"
                              aria-hidden="true"
                            />
                            <span className="hidden sm:inline">Save</span>
                          </Button>,
                        )}
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={8}
                        className="max-w-xs text-xs/relaxed"
                      >
                        <p>
                          Save your changes now. Autosave runs automatically,
                          but manual Save is always available.
                          <ShortcutHint>Ctrl/Cmd+S</ShortcutHint>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {getTooltipTriggerChild(
                          (["disabled", "enabled"] as const)[
                            Number(canDiscardNow)
                          ],
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 px-2 text-xs font-medium sm:px-3",
                              canDiscardNow
                                ? `
                                  text-red-600
                                  hover:bg-red-50
                                  dark:text-red-400
                                  dark:hover:bg-red-950/30
                                `
                                : "text-muted-foreground",
                            )}
                            onClick={() => setIsDiscardDialogOpen(true)}
                            disabled={!canDiscardNow}
                            aria-label="Discard unsaved changes"
                          >
                            <Trash2
                              className="size-4 sm:mr-1.5"
                              aria-hidden="true"
                            />
                            <span className="hidden sm:inline">Discard</span>
                          </Button>,
                        )}
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={8}
                        className="max-w-xs text-xs/relaxed"
                      >
                        <p>
                          Discard unsaved changes and revert to your last loaded
                          state.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-1.5">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="
                            h-8 px-2 text-xs font-medium text-muted-foreground
                            hover:bg-gold/5 hover:text-foreground
                            sm:px-3
                          "
                          onClick={() => setIsHelpDialogOpen(true)}
                          aria-haspopup="dialog"
                          aria-keyshortcuts="Control+H Meta+H"
                          data-tour="help-button"
                        >
                          <Info
                            className="size-4 sm:mr-1.5"
                            aria-hidden="true"
                          />
                          <span className="hidden sm:inline">Help</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={8}
                        className="max-w-xs text-xs/relaxed"
                      >
                        <p>
                          Open help and view all shortcuts.
                          <ShortcutHint>Ctrl/Cmd+H</ShortcutHint>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="h-5 w-px bg-gold/20 dark:bg-gold/15" />
                  <Dialog
                    open={isGlobalSettingsOpen}
                    onOpenChange={setIsGlobalSettingsOpen}
                  >
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              className="
                                h-8 bg-linear-to-r from-gold via-amber-500 to-gold-dim px-2 text-xs
                                font-semibold text-primary-foreground shadow-sm shadow-gold/20
                                transition-all
                                hover:shadow-md hover:shadow-gold/30
                                sm:px-3
                              "
                              data-tour="global-settings"
                            >
                              <SlidersHorizontal className="size-4 sm:mr-1.5" />
                              <span className="hidden sm:inline">Settings</span>
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          sideOffset={8}
                          className="max-w-xs text-xs/relaxed"
                        >
                          <p>
                            Set your default look (colors, borders, and more).
                            Individual cards can still be customized.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
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
                          className="
                            bg-red-600 text-white
                            hover:bg-red-700
                            dark:bg-red-600
                            dark:hover:bg-red-700
                          "
                          onClick={handleDiscardChanges}
                        >
                          Discard changes
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div
                className="
                  relative flex flex-col gap-3 border-2 border-gold/15 bg-gold/3 p-3
                  backdrop-blur-sm
                  dark:border-gold/10 dark:bg-gold/3
                "
                role="toolbar"
                aria-label="Card filters"
              >
                <div className="
                  pointer-events-none absolute top-0 left-0 size-3 border-t-2 border-l-2
                  border-gold/40
                " />
                <div className="
                  pointer-events-none absolute right-0 bottom-0 size-3 border-r-2 border-b-2
                  border-gold/40
                " />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search
                      className="
                        pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2
                        text-muted-foreground
                      "
                      aria-hidden="true"
                    />
                    <Input
                      ref={searchRef}
                      id="card-search"
                      data-tour="card-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search cards… (Ctrl/Cmd+F)"
                      aria-keyshortcuts="Control+F Meta+F"
                      className="h-9 border-gold/20 bg-background px-9 text-sm dark:border-gold/15"
                      title='Try: group:"Core Stats" custom:yes enabled:true'
                    />

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "absolute top-1/2 right-2 -translate-y-1/2",
                              "flex size-7 items-center justify-center",
                              "text-muted-foreground hover:bg-gold/5 hover:text-foreground",
                              `
                                dark:text-muted-foreground
                                dark:hover:bg-gold/5 dark:hover:text-foreground
                              `,
                              `
                                focus:outline-none
                                focus-visible:ring-2 focus-visible:ring-gold/50
                                focus-visible:ring-offset-1
                              `,
                            )}
                            aria-label="Help: searching cards"
                          >
                            <Info className="size-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="max-w-xs text-xs/relaxed"
                        >
                          <p>
                            Search cards by name. Use Ctrl/Cmd+F to focus the
                            search box from anywhere.
                            <ShortcutHint>Ctrl/Cmd+F</ShortcutHint>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={selectedGroup}
                    onValueChange={setSelectedGroup}
                  >
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SelectTrigger
                            id={groupFilterTriggerId}
                            aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
                            className="
                              h-9 w-full border-gold/20 bg-background text-sm
                              sm:w-44
                              dark:border-gold/15
                            "
                          >
                            <SelectValue placeholder="All categories" />
                          </SelectTrigger>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="max-w-xs text-xs/relaxed"
                        >
                          <p>
                            Focus the category filter to limit results to a card
                            group.
                            <ShortcutHint>Ctrl/Cmd+Shift+F</ShortcutHint>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

                <div className="flex items-center gap-2 px-1">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    aria-live="polite"
                  >
                    <span className="text-gold dark:text-gold">
                      {filteredCardCount}
                    </span>
                    <span className="text-muted-foreground">of</span>
                    <span className="text-gold dark:text-gold">
                      {scopeCardCount}
                    </span>
                    <span className="text-muted-foreground">cards in view</span>
                  </span>
                  {activeFilterCount > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="
                        ml-auto h-6 px-2 text-[11px] font-medium text-muted-foreground
                        hover:bg-gold/5 hover:text-foreground
                      "
                    >
                      Clear filters
                    </Button>
                  )}
                </div>

                <div className="gold-line" />

                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="
                      flex items-center gap-0.5 border border-gold/15 bg-gold/3 p-0.5
                      dark:border-gold/10
                    "
                    data-tour="visibility-toggle"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={visibility === "all"}
                      className={cn(
                        "h-8 px-3 text-xs font-medium transition-all",
                        visibility === "all"
                          ? "bg-gold/10 text-gold-dim shadow-sm dark:bg-gold/10 dark:text-gold"
                          : "text-muted-foreground hover:text-foreground",
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
                      aria-keyshortcuts="Control+E Meta+E"
                      className={cn(
                        "h-8 px-3 text-xs font-medium transition-all",
                        visibility === "enabled"
                          ? "bg-gold/10 text-gold-dim shadow-sm dark:bg-gold/10 dark:text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setVisibility("enabled")}
                      title="Toggle enabled-only view (Ctrl/Cmd+E)"
                    >
                      <Eye className="mr-1.5 size-3.5" />
                      Enabled
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={visibility === "disabled"}
                      className={cn(
                        "h-8 px-3 text-xs font-medium transition-all",
                        visibility === "disabled"
                          ? "bg-gold/10 text-gold-dim shadow-sm dark:bg-gold/10 dark:text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setVisibility("disabled")}
                    >
                      <EyeOff className="mr-1.5 size-3.5" />
                      Disabled
                    </Button>

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            data-testid="disabled-cards-info"
                            className={cn(
                              "ml-0.5 flex size-8 items-center justify-center transition-colors",
                              "text-muted-foreground hover:bg-gold/5 hover:text-foreground",
                              `
                                dark:text-muted-foreground
                                dark:hover:bg-gold/5 dark:hover:text-foreground
                              `,
                              `
                                focus:outline-none
                                focus-visible:ring-2 focus-visible:ring-gold/50
                                focus-visible:ring-offset-1
                              `,
                            )}
                            aria-label="Info about disabled cards"
                          >
                            <Info className="size-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs text-xs/relaxed"
                          sideOffset={8}
                        >
                          <p>{DISABLED_CARD_INFO}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="hidden h-6 w-px bg-gold/20 sm:block dark:bg-gold/15" />

                  <div
                    className="
                      flex items-center gap-0.5 border border-gold/15 bg-gold/3 p-0.5
                      dark:border-gold/10
                    "
                    data-tour="customization-toggle"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={customFilter === "all"}
                      className={cn(
                        "h-8 px-3 text-xs font-medium transition-all",
                        customFilter === "all"
                          ? "bg-gold/10 text-gold-dim shadow-sm dark:bg-gold/10 dark:text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setCustomFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={customFilter === "customized"}
                      className={cn(
                        "h-8 px-3 text-xs font-medium transition-all",
                        customFilter === "customized"
                          ? "bg-gold/10 text-gold-dim shadow-sm dark:bg-gold/10 dark:text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setCustomFilter("customized")}
                    >
                      Customized
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={customFilter === "uncustomized"}
                      className={cn(
                        "h-8 px-3 text-xs font-medium transition-all",
                        customFilter === "uncustomized"
                          ? "bg-gold/10 text-gold-dim shadow-sm dark:bg-gold/10 dark:text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setCustomFilter("uncustomized")}
                    >
                      Uncustomized
                    </Button>

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "ml-0.5 flex size-8 items-center justify-center transition-colors",
                              "text-muted-foreground hover:bg-gold/5 hover:text-foreground",
                              `
                                dark:text-muted-foreground
                                dark:hover:bg-gold/5 dark:hover:text-foreground
                              `,
                              `
                                focus:outline-none
                                focus-visible:ring-2 focus-visible:ring-gold/50
                                focus-visible:ring-offset-1
                              `,
                            )}
                            aria-label="Info about customizations filter"
                          >
                            <Info className="size-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs text-xs/relaxed"
                          sideOffset={8}
                        >
                          <p>
                            Filter cards by whether they have custom per-card
                            settings (colors, borders, advanced settings).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="gold-line" />

                <div className="flex flex-wrap items-center gap-1.5">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="
                            size-8 p-0 text-muted-foreground
                            hover:bg-gold/5 hover:text-foreground
                          "
                          onClick={expandAll}
                        >
                          <ChevronsUpDown className="size-4" />
                          <span className="sr-only">Expand all</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className="text-xs"
                      >
                        Expand all categories
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="
                            size-8 p-0 text-muted-foreground
                            hover:bg-gold/5 hover:text-foreground
                          "
                          onClick={collapseAll}
                        >
                          <ChevronsUpDown className="size-4 rotate-90" />
                          <span className="sr-only">Collapse all</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className="text-xs"
                      >
                        Collapse all categories
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="h-5 w-px bg-gold/15" />

                  <ReorderModeToolbarToggle
                    isReorderMode={isReorderMode}
                    canEnterReorderMode={canEnterReorderMode}
                    onToggle={() => setIsReorderMode((prev) => !prev)}
                    dataTour="reorder-toggle"
                  />

                  <div className="h-5 w-px bg-gold/15" />

                  <div className="hidden items-center gap-1 sm:flex">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="
                              size-8 p-0 text-muted-foreground
                              hover:bg-gold/5 hover:text-foreground
                            "
                            onClick={undoBulk}
                            disabled={!canUndoBulk}
                          >
                            <Undo2 className="size-4" />
                            <span className="sr-only">Undo</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="text-xs"
                        >
                          {canUndoBulk
                            ? "Undo last bulk action"
                            : "Nothing to undo"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="
                              size-8 p-0 text-muted-foreground
                              hover:bg-gold/5 hover:text-foreground
                            "
                            onClick={redoBulk}
                            disabled={!canRedoBulk}
                          >
                            <Redo2 className="size-4" />
                            <span className="sr-only">Redo</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="text-xs"
                        >
                          {canRedoBulk
                            ? "Redo last bulk action"
                            : "Nothing to redo"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="h-5 w-px bg-gold/15" />
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="
                              h-8 px-2 text-xs font-medium text-gold-dim
                              hover:bg-gold/8
                              dark:text-gold
                            "
                            onClick={() => {
                              if (allCardIds.length === 0) return;
                              try {
                                enableAllCards();
                                toast.success("Enabled all cards", {
                                  description:
                                    allCardIds.length > 0
                                      ? `${allCardIds.length} cards are now enabled.`
                                      : undefined,
                                  id: "enable-all-cards",
                                });
                              } catch (err) {
                                console.error(
                                  "Failed to enable all cards:",
                                  err,
                                );
                                toast.error("Failed to enable all cards", {
                                  id: "enable-all-cards",
                                });
                              }
                            }}
                          >
                            <Eye className="size-3.5 lg:mr-1" />
                            <span className="hidden lg:inline">Enable All</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="text-xs"
                        >
                          Enable all cards
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {getTooltipTriggerChild(
                            enabledCardIds.length === 0
                              ? "disabled"
                              : "enabled",
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="
                                h-8 px-2 text-xs font-medium text-red-600
                                hover:bg-red-50/80
                                dark:text-red-400
                                dark:hover:bg-red-950/30
                              "
                              onClick={() => {
                                if (enabledCardIds.length === 0) return;
                                setIsDisableAllDialogOpen(true);
                              }}
                              disabled={enabledCardIds.length === 0}
                            >
                              <EyeOff className="size-3.5 lg:mr-1" />
                              <span className="hidden lg:inline">
                                Disable All
                              </span>
                            </Button>,
                          )}
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="text-xs"
                        >
                          Disable all cards
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="
                              h-8 px-2 text-xs font-medium text-muted-foreground
                              hover:bg-gold/5 hover:text-foreground
                            "
                            onClick={() => setIsResetDialogOpen(true)}
                          >
                            <RotateCcw className="size-3.5 lg:mr-1" />
                            <span className="hidden lg:inline">Reset All</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="text-xs"
                        >
                          Reset all cards to global settings
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="ml-auto sm:hidden">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="
                            size-8 p-0 text-muted-foreground
                            hover:bg-gold/5 hover:text-foreground
                          "
                        >
                          <MoreHorizontal className="size-4" />
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
                            <Undo2 className="mr-2 size-4" />
                            Undo
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start"
                            onClick={redoBulk}
                            disabled={!canRedoBulk}
                          >
                            <Redo2 className="mr-2 size-4" />
                            Redo
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start text-gold-dim dark:text-gold"
                            onClick={() => {
                              if (allCardIds.length === 0) return;
                              try {
                                enableAllCards();
                                toast.success("Enabled all cards", {
                                  description:
                                    allCardIds.length > 0
                                      ? `${allCardIds.length} cards are now enabled.`
                                      : undefined,
                                  id: "enable-all-cards",
                                });
                              } catch (err) {
                                console.error(
                                  "Failed to enable all cards:",
                                  err,
                                );
                                toast.error("Failed to enable all cards", {
                                  id: "enable-all-cards",
                                });
                              }
                            }}
                          >
                            <Eye className="mr-2 size-4" />
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
                            <EyeOff className="mr-2 size-4" />
                            Disable All
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start text-muted-foreground"
                            onClick={() => setIsResetDialogOpen(true)}
                          >
                            <RotateCcw className="mr-2 size-4" />
                            Reset All
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

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
                  try {
                    disableAllCards();
                    toast.success("Disabled all enabled cards", {
                      description:
                        enabledCardIds.length > 0
                          ? `${enabledCardIds.length} cards disabled. You can undo this.`
                          : undefined,
                      id: "disable-all-cards",
                    });
                  } catch (err) {
                    console.error("Failed to disable all cards:", err);
                    toast.error("Failed to disable all cards", {
                      id: "disable-all-cards",
                    });
                  } finally {
                    setIsDisableAllDialogOpen(false);
                  }
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
                  try {
                    resetAllCardsToGlobal();
                    toast.success("Reset all cards to global settings", {
                      description:
                        allCardIds.length > 0
                          ? `${allCardIds.length} cards reset. You can undo this.`
                          : undefined,
                      id: "reset-all-cards",
                    });
                  } catch (err) {
                    console.error("Failed to reset all cards:", err);
                    toast.error("Failed to reset all cards", {
                      id: "reset-all-cards",
                    });
                  } finally {
                    setIsResetDialogOpen(false);
                  }
                }}
              />

              <BulkActionLiveRegion message={bulkLastMessage} />
              <ReorderModeHint isVisible={isReorderMode} />
            </motion.div>

            {visibleGroupNames.length === 0 ? (
              <div className="
                relative border-2 border-gold/20 bg-gold/3 p-10 text-center shadow-xl
                backdrop-blur-sm
                dark:border-gold/15 dark:bg-gold/3
              ">
                <div className="
                  pointer-events-none absolute top-0 left-0 size-4 border-t-2 border-l-2 border-gold
                " />
                <div className="
                  pointer-events-none absolute right-0 bottom-0 size-4 border-r-2 border-b-2
                  border-gold
                " />
                <p className="font-display text-base tracking-widest text-foreground uppercase">
                  No cards match your filters
                </p>
                <p className="mt-2 font-body-serif text-sm text-muted-foreground">
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

      <BulkActionsToolbar />
    </div>
  );
}
