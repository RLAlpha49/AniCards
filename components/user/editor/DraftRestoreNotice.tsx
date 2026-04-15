"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";

import { Button } from "@/components/ui/Button";

function formatSavedAt(savedAt: number | null | undefined): string | null {
  if (!savedAt) {
    return null;
  }

  return new Date(savedAt).toLocaleString();
}

export function DraftRestoreNotice({
  isVisible,
  mode = "draft",
  savedAt,
  onRestore,
  onDiscard,
  onDismiss,
}: Readonly<{
  isVisible: boolean;
  mode?: "draft" | "exit-save-fallback";
  savedAt?: number | null;
  onRestore: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}>) {
  if (!isVisible) return null;

  const savedAtLabel = formatSavedAt(savedAt);
  const isExitSaveFallback = mode === "exit-save-fallback";

  return (
    <div className="flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="
          w-full max-w-[700px] border border-gold/20 bg-linear-to-r from-gold/5 to-amber-100/5 px-4
          py-3 backdrop-blur-sm
          dark:border-gold/15 dark:from-gold/3 dark:to-amber-900/3
        "
      >
        <div className="flex items-start gap-3">
          <div className="
            mt-0.5 flex size-8 shrink-0 items-center justify-center bg-gold/15
            dark:bg-gold/10
          ">
            <History className="size-4 text-gold-dim dark:text-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {isExitSaveFallback
                  ? "Exit save couldn't finish:"
                  : "Draft found:"}
              </span>{" "}
              {isExitSaveFallback
                ? "AniCards couldn't queue the last background save when you left this page, so a local recovery draft was kept for review."
                : "we found unsaved changes from a previous session."}
            </p>

            {savedAtLabel ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {isExitSaveFallback ? "Recovery draft saved" : "Draft saved"}:{" "}
                {savedAtLabel}
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onRestore}
              >
                {isExitSaveFallback
                  ? "Review & restore draft"
                  : "Restore draft"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={onDiscard}
              >
                {isExitSaveFallback
                  ? "Discard recovery draft"
                  : "Discard draft"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
