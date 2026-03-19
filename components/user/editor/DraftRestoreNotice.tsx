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
        className="border-gold/20 from-gold/5 dark:border-gold/15 dark:from-gold/3 w-full max-w-[700px] rounded-xl border bg-linear-to-r to-amber-100/5 px-4 py-3 backdrop-blur-sm dark:to-amber-900/3"
      >
        <div className="flex items-start gap-3">
          <div className="bg-gold/15 dark:bg-gold/10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <History className="text-gold-dim dark:text-gold h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm">
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
