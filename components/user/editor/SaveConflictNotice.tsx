"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Clock3, ListOrdered, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

type SaveConflictNoticeSummary = {
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
};

function formatTimestamp(
  value: number | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

export function SaveConflictNotice({
  isVisible,
  summary,
  onKeepEdits,
  onReloadLatest,
}: Readonly<{
  isVisible: boolean;
  summary?: SaveConflictNoticeSummary | null;
  onKeepEdits: () => void;
  onReloadLatest: () => void;
}>) {
  if (!isVisible) return null;

  const localLastSavedLabel = formatTimestamp(summary?.lastSavedAt);
  const conflictDetectedLabel = formatTimestamp(summary?.attemptedAt);
  const serverUpdatedAtLabel = formatTimestamp(summary?.currentUpdatedAt);

  return (
    <div className="flex justify-center" role="alert">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="
          w-full max-w-[700px] border border-red-200/60 bg-linear-to-r from-red-50/80 to-amber-50/80
          px-4 py-3 backdrop-blur-sm
          dark:border-red-900/50 dark:from-red-950/25 dark:to-amber-950/20
        "
      >
        <div className="flex items-start gap-3">
          <div className="
            mt-0.5 flex size-8 shrink-0 items-center justify-center bg-red-100
            dark:bg-red-900/40
          ">
            <AlertTriangle className="size-4 text-red-700 dark:text-red-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-medium">Save conflict:</span> another tab
              saved changes. Reload to sync, then re-apply your edits. Review
              the pending edits below before you continue.
            </p>

            {summary ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="
                    border border-red-200/60 bg-white/60 px-3 py-2 text-xs
                    dark:border-red-900/40 dark:bg-black/10
                  ">
                    <div className="font-medium text-red-900 dark:text-red-100">
                      Edited cards
                    </div>
                    <div className="mt-1 text-red-700 dark:text-red-200">
                      {summary.changedCardCount === 0
                        ? "No per-card edits"
                        : `${summary.changedCardCount} pending change${summary.changedCardCount === 1 ? "" : "s"}`}
                    </div>
                  </div>

                  <div className="
                    border border-red-200/60 bg-white/60 px-3 py-2 text-xs
                    dark:border-red-900/40 dark:bg-black/10
                  ">
                    <div className="font-medium text-red-900 dark:text-red-100">
                      Global settings
                    </div>
                    <div className="mt-1 text-red-700 dark:text-red-200">
                      {summary.changedGlobalSettingCount === 0
                        ? "No global edits"
                        : `${summary.changedGlobalSettingCount} setting${summary.changedGlobalSettingCount === 1 ? "" : "s"} changed`}
                    </div>
                  </div>

                  <div className="
                    border border-red-200/60 bg-white/60 px-3 py-2 text-xs
                    dark:border-red-900/40 dark:bg-black/10
                  ">
                    <div className="font-medium text-red-900 dark:text-red-100">
                      Card order
                    </div>
                    <div className="mt-1 text-red-700 dark:text-red-200">
                      {summary.reorderedCardCount === 0
                        ? "No reorder changes"
                        : `${summary.reorderedCardCount} position${summary.reorderedCardCount === 1 ? "" : "s"} changed`}
                    </div>
                  </div>
                </div>

                {summary.changedCards.length > 0 ? (
                  <div className="
                    rounded-none border border-red-200/60 bg-white/60 px-3 py-2 text-xs
                    dark:border-red-900/40 dark:bg-black/10
                  ">
                    <div className="font-medium text-red-900 dark:text-red-100">
                      Pending card edits
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.changedCards.map((card) => (
                        <span
                          key={card.cardId}
                          className="
                            inline-flex items-center gap-1 border border-red-200/70 bg-red-50/70
                            px-2 py-1 text-[11px] text-red-800
                            dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100
                          "
                        >
                          <ListOrdered className="size-3" aria-hidden="true" />
                          {card.label}
                        </span>
                      ))}
                      {summary.remainingChangedCardCount > 0 ? (
                        <span className="
                          inline-flex items-center px-2 py-1 text-[11px] text-red-700
                          dark:text-red-200
                        ">
                          +{summary.remainingChangedCardCount} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="
                  flex flex-wrap gap-x-4 gap-y-2 text-xs text-red-700
                  dark:text-red-200
                ">
                  {localLastSavedLabel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3" aria-hidden="true" />
                      Last saved here: {localLastSavedLabel}
                    </span>
                  ) : null}
                  {serverUpdatedAtLabel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3" aria-hidden="true" />
                      Latest server save: {serverUpdatedAtLabel}
                    </span>
                  ) : null}
                  {conflictDetectedLabel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3" aria-hidden="true" />
                      Conflict detected: {conflictDetectedLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onKeepEdits}
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                Reload & keep my edits
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={onReloadLatest}
              >
                Reload latest
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
