"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useReducer,useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ExternalLink,
  User as UserIcon,
  Check,
  Loader2,
  AlertCircle,
  Save,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { baseVariants } from "@/components/PageShell";

/**
 * Save state for displaying save status.
 * @source
 */
interface SaveState {
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
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
  return `${Math.floor(seconds / 3600)}h ago`;
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
};

function getSaveStateInfo(saveState?: SaveState): SaveStateInfo {
  if (!saveState) {
    return {
      Icon: Clock,
      text: "No changes",
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    };
  }

  if (saveState.isSaving) {
    return {
      Icon: Loader2,
      text: "Saving...",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      spinner: true,
    };
  }

  if (saveState.saveError) {
    return {
      Icon: AlertCircle,
      text: "Save failed",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
  }

  if (saveState.isDirty) {
    return {
      Icon: Save,
      text: "Unsaved",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }

  if (saveState.lastSavedAt) {
    return {
      Icon: Check,
      text: getTimeSince(saveState.lastSavedAt),
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    };
  }

  return {
    Icon: Clock,
    text: "No changes",
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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
  if (username) return `https://anilist.co/user/${username}`;
  if (userId) return `https://anilist.co/user/${userId}`;
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
  return avatarUrl && !imageError ? (
    <Image
      src={avatarUrl}
      alt={username || "User avatar"}
      width={100}
      height={100}
      className={cn(
        "relative h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg dark:border-slate-800 sm:h-24 sm:w-24",
        imageClassName,
      )}
      onError={() => setImageError(true)}
    />
  ) : (
    <div
      className={cn(
        "relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg dark:border-slate-800 sm:h-24 sm:w-24",
        fallbackClassName,
      )}
    >
      <UserIcon className="h-10 w-10 text-white sm:h-12 sm:w-12" />
    </div>
  );
}

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

  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (
      !saveState?.lastSavedAt ||
      saveState.isSaving ||
      saveState.isDirty ||
      saveState.saveError
    ) {
      return;
    }
    const id = setInterval(forceUpdate, 1000);
    return () => clearInterval(id);
  }, [
    saveState?.lastSavedAt,
    saveState?.isSaving,
    saveState?.isDirty,
    saveState?.saveError,
  ]);

  const saveInfo = saveState ? getSaveStateInfo(saveState) : undefined;

  return (
    <motion.header
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative"
    >
      {/* Main header content */}
      <div className="mx-auto max-w-4xl">
        {/* Top section with user info */}
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-6 text-center">
            {/* Avatar */}
            <motion.div variants={itemVariants} className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 opacity-75 blur-sm" />
              {anilistUrl ? (
                <a
                  href={anilistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block transition-transform hover:scale-105 active:scale-95"
                  aria-label={`View ${username || "user"}'s AniList profile`}
                >
                  <Avatar
                    avatarUrl={avatarUrl}
                    username={username}
                    imageClassName="transition-all group-hover:border-blue-400 dark:group-hover:border-blue-500"
                    fallbackClassName="transition-all group-hover:border-blue-400 dark:group-hover:border-blue-500"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md sm:h-8 sm:w-8">
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                  </div>
                </a>
              ) : (
                <div className="relative">
                  <Avatar avatarUrl={avatarUrl} username={username} />
                </div>
              )}
            </motion.div>

            {/* User info and title */}
            <div className="flex flex-1 flex-col items-center text-center">
              <motion.h1
                variants={itemVariants}
                className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
              >
                {username ? (
                  <>
                    <span className="block text-base font-medium text-slate-500 dark:text-slate-400 sm:text-xl">
                      Welcome back,
                    </span>
                    <span className="mt-1 block">{username}</span>
                  </>
                ) : (
                  <span className="block">Your Dashboard</span>
                )}
              </motion.h1>
            </div>

            {/* Save status indicator */}
            {saveInfo && (
              <motion.div variants={itemVariants} className="shrink-0">
                <output
                  aria-live="polite"
                  aria-atomic="true"
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    saveInfo.className,
                  )}
                >
                  {saveInfo.spinner ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <saveInfo.Icon className="h-4 w-4" />
                  )}
                  <span>{saveInfo.text}</span>
                </output>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
