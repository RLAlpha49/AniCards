"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function DraftRestoreNotice({
  isVisible,
  onRestore,
  onDiscard,
  onDismiss,
}: Readonly<{
  isVisible: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}>) {
  if (!isVisible) return null;

  return (
    <div className="flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-[700px] rounded-xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 px-4 py-3 backdrop-blur-sm dark:border-indigo-900/40 dark:from-indigo-950/25 dark:to-purple-950/20"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
            <History className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-indigo-900 dark:text-indigo-100">
              <span className="font-medium">Draft found:</span> we found unsaved
              changes from a previous session.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-xl sm:w-auto"
                onClick={onRestore}
              >
                Restore draft
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={onDiscard}
              >
                Discard draft
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
