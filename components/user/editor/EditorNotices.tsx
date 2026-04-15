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
import type { EditorStarterStyle } from "@/lib/user-page-starters";

import { DraftRestoreNotice } from "./DraftRestoreNotice";
import { SaveConflictNotice } from "./SaveConflictNotice";

export function EditorNotices({
  showConflictNotice,
  conflictNoticeSummary,
  onResolveConflictKeepEdits,
  onResolveConflictDiscardEdits,
  showDraftNotice,
  draftNoticeMode,
  draftSavedAt,
  onRestoreDraft,
  onDiscardDraft,
  onDismissDraftNotice,
  isNewUser,
  onDismissNewUser,
  starterStyles,
  onApplyStarterStyle,
  onOpenHelp,
  onStartTour,
  cardsWarning,
  onDismissCardsWarning,
}: Readonly<{
  showConflictNotice: boolean;
  conflictNoticeSummary?: {
    attemptedAt: number;
    changedCardCount: number;
    changedCards: Array<{
      cardId: string;
      group?: string;
      label: string;
    }>;
    changedGlobalSettingCount: number;
    currentUpdatedAt?: string;
    lastSavedAt: number | null;
    remainingChangedCardCount: number;
    reorderedCardCount: number;
  } | null;
  onResolveConflictKeepEdits: () => void;
  onResolveConflictDiscardEdits: () => void;
  showDraftNotice: boolean;
  draftNoticeMode?: "draft" | "exit-save-fallback";
  draftSavedAt?: number | null;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
  onDismissDraftNotice: () => void;
  isNewUser: boolean;
  onDismissNewUser: () => void;
  starterStyles: readonly EditorStarterStyle[];
  onApplyStarterStyle: (starterStyle: EditorStarterStyle) => void;
  onOpenHelp: () => void;
  onStartTour: () => void;
  cardsWarning: string | null;
  onDismissCardsWarning: () => void;
}>) {
  return (
    <div className="mx-auto mt-6 flex max-w-[80vw] flex-col gap-4">
      <SaveConflictNotice
        isVisible={showConflictNotice}
        summary={conflictNoticeSummary}
        onKeepEdits={onResolveConflictKeepEdits}
        onReloadLatest={onResolveConflictDiscardEdits}
      />

      <DraftRestoreNotice
        isVisible={showDraftNotice}
        mode={draftNoticeMode}
        savedAt={draftSavedAt}
        onRestore={onRestoreDraft}
        onDiscard={onDiscardDraft}
        onDismiss={onDismissDraftNotice}
      />

      {isNewUser && (
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="
              w-full max-w-125 border border-green-200/60 bg-linear-to-r from-green-50/80
              to-emerald-50/80 px-4 py-3 backdrop-blur-sm
              dark:border-green-800/40 dark:from-green-950/30 dark:to-emerald-950/30
            "
          >
            <div className="flex items-start gap-3">
              <div className="
                mt-0.5 flex size-8 shrink-0 items-center justify-center bg-green-100
                dark:bg-green-900/50
              ">
                <UserPlus className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <span className="font-medium">Welcome to AniCards!</span> Your
                  profile is ready with a curated starter set. Pick a starter
                  style below, then tweak anything you like in Global Settings.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissNewUser}
                className="
                  size-6 shrink-0 rounded-full p-0 text-green-600
                  hover:bg-green-100 hover:text-green-800
                  dark:text-green-400
                  dark:hover:bg-green-900/50 dark:hover:text-green-200
                "
                aria-label="Dismiss welcome notice"
              >
                <X className="size-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {isNewUser && (
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="
              w-full max-w-[700px] border border-gold/20 bg-gold/3 p-4 backdrop-blur-sm
              dark:border-gold/15 dark:bg-gold/3
            "
          >
            <div className="flex items-start gap-3">
              <div className="
                mt-0.5 flex size-8 shrink-0 items-center justify-center bg-gold/15
                dark:bg-gold/10
              ">
                <Info
                  className="size-4 text-gold-dim dark:text-gold"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Quick start
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Start with the curated cards below — you can enable the rest
                    whenever you're ready.
                  </li>
                  <li>
                    Try one of the starter styles here, then open{" "}
                    <strong>Global Settings</strong> to fine-tune it.
                  </li>
                  <li>
                    Want more looks? The live examples gallery can pipe a style
                    straight into this editor as a reusable template.
                  </li>
                </ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  {starterStyles.map((starterStyle) => (
                    <Button
                      key={starterStyle.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyStarterStyle(starterStyle)}
                      className="border-gold/20 bg-background/70"
                    >
                      {starterStyle.name}
                    </Button>
                  ))}

                  <a
                    href="/examples"
                    className="
                      inline-flex items-center gap-1.5 border border-gold/20 bg-gold/8 px-3 py-2
                      text-xs font-semibold tracking-[0.16em] text-gold-dim uppercase
                      transition-colors
                      hover:border-gold/35 hover:bg-gold/12
                      dark:text-gold
                    "
                  >
                    Browse examples
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Example styles land in the same template library used by the
                  editor, so you can reapply them later instead of rebuilding a
                  look from scratch.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={onOpenHelp}
                    aria-haspopup="dialog"
                  >
                    Learn more
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
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
            className="
              w-full max-w-[700px] border border-yellow-200/60 bg-linear-to-r from-yellow-50/80
              to-amber-50/80 px-4 py-3 backdrop-blur-sm
              dark:border-yellow-800/40 dark:from-yellow-950/30 dark:to-amber-950/30
            "
          >
            <div className="flex items-start gap-3">
              <div className="
                mt-0.5 flex size-8 shrink-0 items-center justify-center bg-yellow-100
                dark:bg-yellow-900/50
              ">
                <AlertTriangle className="size-4 text-yellow-700 dark:text-yellow-300" />
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
                className="
                  size-6 shrink-0 rounded-full p-0 text-yellow-700
                  hover:bg-yellow-100 hover:text-yellow-900
                  dark:text-yellow-300
                  dark:hover:bg-yellow-900/50 dark:hover:text-yellow-100
                "
                aria-label="Dismiss card loading warning"
              >
                <X className="size-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col justify-center gap-4 md:flex-row md:flex-wrap lg:flex-nowrap">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="
            max-w-[500px] flex-1 border border-gold/20 bg-linear-to-r from-gold/5 to-amber-100/5
            px-4 py-3 backdrop-blur-sm
            dark:border-gold/15 dark:from-gold/3 dark:to-amber-900/3
          "
        >
          <div className="flex items-start gap-3">
            <div className="
              mt-0.5 flex size-8 shrink-0 items-center justify-center bg-gold/15
              dark:bg-gold/10
            ">
              <RefreshCw className="size-4 text-gold-dim dark:text-gold" />
            </div>
            <p className="text-sm text-foreground">
              <span className="font-medium">Set it and forget it!</span> Stats
              update automatically every day. Your card URLs always show the
              latest data.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="
            max-w-[500px] flex-1 border border-gold/20 bg-linear-to-r from-gold/5 via-amber-100/5
            to-gold/3 px-4 py-3 backdrop-blur-sm
            dark:border-gold/15 dark:from-gold/3 dark:via-amber-900/3 dark:to-gold/2
          "
        >
          <div className="flex items-start gap-3">
            <div className="
              mt-0.5 flex size-8 shrink-0 items-center justify-center bg-linear-to-br from-gold
              via-amber-500 to-gold-dim shadow-lg shadow-gold/20
            ">
              <Heart className="size-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">Enjoying AniCards?</span> If you
                find this project useful, consider crediting it in your AniList
                bio. It helps others discover AniCards!
              </p>
            </div>
            <a
              href="https://anilist.co/user/Alpha49"
              target="_blank"
              rel="noopener noreferrer"
              className="
                mt-0.5 inline-flex items-center gap-1.5 border border-gold/20 bg-gold/5 px-2.5 py-1
                text-xs font-medium text-gold-dim transition-all
                hover:border-gold/30 hover:bg-gold/10
                dark:border-gold/15 dark:bg-gold/5 dark:text-gold
                dark:hover:border-gold/25
              "
            >
              <ExternalLink className="size-3" />
              @Alpha49
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
