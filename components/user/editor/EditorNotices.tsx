"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ExternalLink,
  Heart,
  Info,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { DraftRestoreNotice } from "./DraftRestoreNotice";
import { SaveConflictNotice } from "./SaveConflictNotice";

export function EditorNotices({
  showConflictNotice,
  onResolveConflictKeepEdits,
  onResolveConflictDiscardEdits,
  showDraftNotice,
  onRestoreDraft,
  onDiscardDraft,
  onDismissDraftNotice,
  isNewUser,
  onDismissNewUser,
  onOpenHelp,
  onStartTour,
  cardsWarning,
  onDismissCardsWarning,
}: Readonly<{
  showConflictNotice: boolean;
  onResolveConflictKeepEdits: () => void;
  onResolveConflictDiscardEdits: () => void;
  showDraftNotice: boolean;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
  onDismissDraftNotice: () => void;
  isNewUser: boolean;
  onDismissNewUser: () => void;
  onOpenHelp: () => void;
  onStartTour: () => void;
  cardsWarning: string | null;
  onDismissCardsWarning: () => void;
}>) {
  return (
    <div className="mx-auto mt-6 flex max-w-[80vw] flex-col gap-4">
      <SaveConflictNotice
        isVisible={showConflictNotice}
        onKeepEdits={onResolveConflictKeepEdits}
        onReloadLatest={onResolveConflictDiscardEdits}
      />

      <DraftRestoreNotice
        isVisible={showDraftNotice}
        onRestore={onRestoreDraft}
        onDiscard={onDiscardDraft}
        onDismiss={onDismissDraftNotice}
      />

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
                  <span className="font-medium">Welcome to AniCards!</span> Your
                  profile is ready. Enable cards below and customize them in
                  Global Settings.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissNewUser}
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
                    Enable the cards you want below (you can always change this
                    later).
                  </li>
                  <li>
                    Open <strong>Global Settings</strong> to set your default
                    style.
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
                    onClick={onOpenHelp}
                    aria-haspopup="dialog"
                  >
                    Learn more
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl sm:w-auto"
                    onClick={onStartTour}
                  >
                    Start tour
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
                onClick={onDismissCardsWarning}
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
              <span className="font-medium">Set it and forget it!</span> Stats
              update automatically every day. Your card URLs always show the
              latest data.
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
                <span className="font-medium">Enjoying AniCards?</span> If you
                find this project useful, consider crediting it in your AniList
                bio. It helps others discover AniCards!
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
  );
}
