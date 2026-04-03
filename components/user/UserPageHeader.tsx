"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Save,
  User as UserIcon,
} from "lucide-react";
import { memo, useEffect, useReducer, useState } from "react";

import { baseVariants } from "@/components/PageShell";
import { cn } from "@/lib/utils";

/**
 * Save state for displaying save status.
 * @source
 */
interface SaveState {
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
  isAutoSaveQueued?: boolean;
  autoSaveDueAt?: number | null;
  hasConflict?: boolean;
}

/**
 * Props for UserPageHeader component.
 * @source
 */
interface UserPageHeaderProps {
  /** AniList username */
  username: string | null;
  /** AniList user ID */
  userId: string | null;
  /** User avatar URL (optional) */
  avatarUrl?: string;
  /** Save state for displaying status */
  saveState?: SaveState;
}

const containerVariants = {
  ...baseVariants,
  visible: {
    ...baseVariants.visible,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { ...baseVariants.hidden, y: 16 },
  visible: {
    ...baseVariants.visible,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

/**
 * Returns a formatted time string for the last saved time.
 * @param lastSavedAt - Timestamp of last save
 * @returns Formatted time string
 */
function getTimeSince(lastSavedAt: number | null): string {
  if (!lastSavedAt) return "";
  const seconds = Math.floor((Date.now() - lastSavedAt) / 1000);
  if (seconds < 0) return "Just now";
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getTimeUntil(dueAt: number | null | undefined): string {
  if (!dueAt) return "soon";
  const ms = dueAt - Date.now();
  if (ms <= 0) return "now";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}

/**
 * Simplifies save-state derivation for rendering the UI.
 * Returns the icon component, text, and contextual className.
 */
type SaveStateInfo = {
  Icon: LucideIcon;
  text: string;
  className: string;
  spinner?: boolean;
  title?: string;
};

function getSaveStateInfo(saveState?: SaveState): SaveStateInfo {
  if (!saveState) {
    return {
      Icon: Clock,
      text: "No changes",
      className:
        "border border-gold/20 bg-gold/5 text-gold-dim dark:border-gold/15 dark:bg-gold/5 dark:text-gold",
    };
  }

  if (saveState.hasConflict) {
    return {
      Icon: AlertCircle,
      text: "Out of sync",
      className:
        "border border-red-300/40 bg-red-100 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-400",
      title:
        "A save conflict was detected. Reload to sync with the latest settings.",
    };
  }

  if (saveState.isAutoSaveQueued) {
    return {
      Icon: Loader2,
      text: `Auto-save in ${getTimeUntil(saveState.autoSaveDueAt)}`,
      className:
        "border border-gold/20 bg-gold/5 text-gold-dim dark:border-gold/15 dark:bg-gold/5 dark:text-gold",
      spinner: true,
      title: "Your changes will be saved automatically.",
    };
  }

  if (saveState.isSaving) {
    return {
      Icon: Loader2,
      text: "Saving...",
      className:
        "border border-gold/30 bg-gold/10 text-gold-dim dark:border-gold/25 dark:bg-gold/10 dark:text-gold",
      spinner: true,
      title: "Syncing your changes...",
    };
  }

  if (saveState.saveError) {
    return {
      Icon: AlertCircle,
      text: "Sync failed",
      className:
        "border border-red-300/40 bg-red-100 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-400",
      title: saveState.saveError,
    };
  }

  if (saveState.isDirty) {
    return {
      Icon: Save,
      text: "Unsaved changes",
      className:
        "border border-amber-300/40 bg-amber-100 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-400",
      title: "Changes are waiting to be saved.",
    };
  }

  if (saveState.lastSavedAt) {
    return {
      Icon: Check,
      text: `Saved ${getTimeSince(saveState.lastSavedAt)} · Synced`,
      className:
        "border border-gold/30 bg-gold/10 text-gold-dim dark:border-gold/20 dark:bg-gold/10 dark:text-gold",
      title: new Date(saveState.lastSavedAt).toLocaleString(),
    };
  }

  return {
    Icon: Clock,
    text: "No changes",
    className:
      "border border-gold/20 bg-gold/5 text-gold-dim dark:border-gold/15 dark:bg-gold/5 dark:text-gold",
  };
}

/**
 * Build an AniList profile URL from a username or userId.
 * Accepts username (string|null|undefined) or userId (string|number|null|undefined).
 * Returns the profile URL string or null if neither identifier is provided.
 */
function getAnilistUrl(
  username?: string | null,
  userId?: string | number | null,
): string | null {
  if (username)
    return `https://anilist.co/user/${encodeURIComponent(username)}`;
  if (userId)
    return `https://anilist.co/user/${encodeURIComponent(String(userId))}`;
  return null;
}

/**
 * Presentational Avatar component that renders the image or fallback icon.
 * Accepts className variants for image and fallback to allow adding hover/group classes.
 */
function Avatar({
  avatarUrl,
  username,
  imageClassName = "",
  fallbackClassName = "",
}: {
  avatarUrl?: string;
  username?: string | null;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  return avatarUrl && !imageError ? (
    <img
      src={avatarUrl}
      alt={username || "User avatar"}
      width={100}
      height={100}
      className={cn(
        `
          relative size-20 rounded-full border-[3px] border-gold/40 object-cover shadow-lg
          shadow-gold/10
          sm:size-24
          dark:border-gold/30
        `,
        imageClassName,
      )}
      onError={() => setImageError(true)}
    />
  ) : (
    <div
      className={cn(
        `
          relative flex size-20 items-center justify-center rounded-full border-[3px] border-gold/40
          bg-linear-to-br from-gold/20 via-gold/10 to-amber-900/20 shadow-lg shadow-gold/10
          sm:size-24
          dark:border-gold/30 dark:from-gold/15 dark:via-gold/5 dark:to-amber-900/15
        `,
        fallbackClassName,
      )}
    >
      <UserIcon className="size-10 text-gold sm:size-12" />
    </div>
  );
}

const SaveStatusBadge = memo(function SaveStatusBadge({
  saveState,
}: Readonly<{ saveState?: SaveState }>) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!saveState) return;

    const shouldTickForLastSaved =
      Boolean(saveState.lastSavedAt) &&
      !saveState.isSaving &&
      !saveState.isDirty &&
      !saveState.saveError &&
      !saveState.hasConflict;

    const shouldTickForQueuedSave =
      Boolean(saveState.isAutoSaveQueued) && Boolean(saveState.autoSaveDueAt);

    if (!shouldTickForLastSaved && !shouldTickForQueuedSave) return;

    const id = setInterval(forceUpdate, 1000);
    return () => clearInterval(id);
  }, [
    saveState?.autoSaveDueAt,
    saveState?.hasConflict,
    saveState?.isAutoSaveQueued,
    saveState?.isDirty,
    saveState?.isSaving,
    saveState?.lastSavedAt,
    saveState?.saveError,
  ]);

  const saveInfo = getSaveStateInfo(saveState);

  return (
    <motion.div variants={itemVariants} className="shrink-0">
      <output
        aria-live="polite"
        aria-atomic="true"
        title={saveInfo.title}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
          saveInfo.className,
        )}
      >
        {saveInfo.spinner ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <saveInfo.Icon className="size-4" />
        )}
        <span>{saveInfo.text}</span>
      </output>
    </motion.div>
  );
});

SaveStatusBadge.displayName = "SaveStatusBadge";

/**
 * Header section for the user page with user info, stats.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
export function UserPageHeader({
  username,
  userId,
  avatarUrl,
  saveState,
}: Readonly<UserPageHeaderProps>) {
  const anilistUrl = getAnilistUrl(username, userId);

  return (
    <motion.header
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative"
    >
      <div className="relative mx-auto max-w-4xl">
        <div className="imperial-card border-gold/20! bg-transparent! p-0! dark:border-gold/12!">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
            <div className="flex flex-col items-center gap-8 text-center">
              <motion.div variants={itemVariants} className="relative shrink-0">
                <div className="
                  absolute -inset-3 rounded-full bg-linear-to-br from-gold/40 via-amber-500/20
                  to-gold/40 opacity-60 blur-lg
                " />
                <div className="
                  absolute -inset-1 rounded-full border border-gold/20
                  dark:border-gold/15
                " />
                {anilistUrl ? (
                  <a
                    href={anilistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      group relative block transition-transform
                      hover:scale-105
                      active:scale-95
                    "
                    aria-label={`View ${username || "user"}'s AniList profile`}
                  >
                    <Avatar
                      avatarUrl={avatarUrl}
                      username={username}
                      imageClassName="transition-all group-hover:border-gold/60 dark:group-hover:border-gold/50"
                      fallbackClassName="transition-all group-hover:border-gold/60 dark:group-hover:border-gold/50"
                    />
                    <div className="
                      absolute -right-1 -bottom-1 flex size-7 items-center justify-center
                      rounded-full border-2 border-gold/40 bg-linear-to-br from-gold via-amber-500
                      to-gold-dim text-primary-foreground shadow-lg shadow-gold/20
                      sm:size-8
                    ">
                      <ExternalLink className="size-3 sm:size-4" />
                    </div>
                  </a>
                ) : (
                  <div className="relative">
                    <Avatar avatarUrl={avatarUrl} username={username} />
                  </div>
                )}
              </motion.div>

              <div className="flex flex-1 flex-col items-center text-center">
                <motion.h1
                  variants={itemVariants}
                  className="
                    text-3xl/tight font-bold tracking-tight text-foreground
                    sm:text-4xl
                    lg:text-5xl
                  "
                >
                  {username ? (
                    <>
                      <span className="
                        block text-xs tracking-[0.35em] text-gold-dim uppercase
                        sm:text-sm
                        dark:text-gold
                      ">
                        ✦ Welcome back ✦
                      </span>
                      <span className="mt-3 block font-display">
                        {username}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="
                        block text-xs tracking-[0.35em] text-gold-dim uppercase
                        sm:text-sm
                        dark:text-gold
                      ">
                        ✦ Dashboard ✦
                      </span>
                      <span className="mt-3 block font-display">
                        Your Collection
                      </span>
                    </>
                  )}
                </motion.h1>
                <motion.div
                  variants={itemVariants}
                  className="gold-line-thick mt-6 w-24"
                />
                <motion.p
                  variants={itemVariants}
                  className="
                    mt-4 max-w-md font-body-serif text-sm/relaxed text-muted-foreground
                    sm:text-base
                  "
                >
                  Curate your stat cards, customize their appearance, and share
                  your anime journey.
                </motion.p>
              </div>

              <SaveStatusBadge saveState={saveState} />
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
