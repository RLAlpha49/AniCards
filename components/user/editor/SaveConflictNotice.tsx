"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function SaveConflictNotice({
  isVisible,
  onKeepEdits,
  onReloadLatest,
}: Readonly<{
  isVisible: boolean;
  onKeepEdits: () => void;
  onReloadLatest: () => void;
}>) {
  if (!isVisible) return null;

  return (
    <div className="flex justify-center" role="alert">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="w-full max-w-[700px] border border-red-200/60 bg-gradient-to-r from-red-50/80 to-amber-50/80 px-4 py-3 backdrop-blur-sm dark:border-red-900/50 dark:from-red-950/25 dark:to-amber-950/20"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-red-100 dark:bg-red-900/40">
            <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-medium">Save conflict:</span> another tab
              saved changes. Reload to sync, then re-apply your edits.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onKeepEdits}
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Reload & keep edits
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
