"use client";

import Image from "next/image";
import { motion } from "framer-motion";
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
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
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
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
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
  const getAnilistUrl = (): string | null => {
    if (username) return `https://anilist.co/user/${username}`;
    if (userId) return `https://anilist.co/user/${userId}`;
    return null;
  };
  const anilistUrl = getAnilistUrl();

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
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={username || "User avatar"}
                      width={100}
                      height={100}
                      className="relative h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg transition-all group-hover:border-blue-400 dark:border-slate-800 dark:group-hover:border-blue-500 sm:h-24 sm:w-24"
                      unoptimized
                    />
                  ) : (
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg transition-all group-hover:border-blue-400 dark:border-slate-800 dark:group-hover:border-blue-500 sm:h-24 sm:w-24">
                      <UserIcon className="h-10 w-10 text-white sm:h-12 sm:w-12" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md sm:h-8 sm:w-8">
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                  </div>
                </a>
              ) : (
                <div className="relative">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={username || "User avatar"}
                      width={100}
                      height={100}
                      className="relative h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg dark:border-slate-800 sm:h-24 sm:w-24"
                      unoptimized
                    />
                  ) : (
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg dark:border-slate-800 sm:h-24 sm:w-24">
                      <UserIcon className="h-10 w-10 text-white sm:h-12 sm:w-12" />
                    </div>
                  )}
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
            {saveState && (
              <motion.div variants={itemVariants} className="shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    saveState.isSaving &&
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                    saveState.saveError &&
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                    !saveState.isSaving &&
                      !saveState.saveError &&
                      saveState.isDirty &&
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    !saveState.isSaving &&
                      !saveState.saveError &&
                      !saveState.isDirty &&
                      saveState.lastSavedAt &&
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                    !saveState.isSaving &&
                      !saveState.saveError &&
                      !saveState.isDirty &&
                      !saveState.lastSavedAt &&
                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {saveState.isSaving && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  )}
                  {saveState.saveError && (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <span>Save failed</span>
                    </>
                  )}
                  {!saveState.isSaving &&
                    !saveState.saveError &&
                    saveState.isDirty && (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Unsaved</span>
                      </>
                    )}
                  {!saveState.isSaving &&
                    !saveState.saveError &&
                    !saveState.isDirty &&
                    saveState.lastSavedAt && (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{getTimeSince(saveState.lastSavedAt)}</span>
                      </>
                    )}
                  {!saveState.isSaving &&
                    !saveState.saveError &&
                    !saveState.isDirty &&
                    !saveState.lastSavedAt && (
                      <>
                        <Clock className="h-4 w-4" />
                        <span>No changes</span>
                      </>
                    )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
