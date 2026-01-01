"use client";

import { useEffect, useRef } from "react";
import {
  buildLocalEditsPatch,
  useUserPageEditor,
} from "../lib/stores/user-page-editor";
import {
  clearUserPageDraft,
  writeUserPageDraft,
} from "../lib/user-page-editor-draft";

interface UseUserPageDraftBackupOptions {
  /** Whether draft persistence is enabled. Default: true */
  enabled?: boolean;
  /** Debounce delay in milliseconds. Default: 750ms */
  debounceMs?: number;
}

/**
 * Persist a localStorage draft of the user's unsaved editor changes.
 *
 * - Writes a minimal patch (diff vs. baseline) while the editor is dirty.
 * - Clears the draft after a successful save or explicit discard.
 */
export function useUserPageDraftBackup(
  options: UseUserPageDraftBackupOptions = {},
) {
  const { enabled = true, debounceMs = 750 } = options;

  const userId = useUserPageEditor((s) => s.userId);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!userId) return;

    const scheduleWrite = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      timerRef.current = setTimeout(() => {
        const snapshot = useUserPageEditor.getState();
        if (snapshot.userId !== userId) return;
        if (!snapshot.isDirty) return;

        const patch = buildLocalEditsPatch(snapshot);
        if (!patch) return;

        writeUserPageDraft(userId, patch);
      }, debounceMs);
    };

    const unsubscribe = useUserPageEditor.subscribe((next, prev) => {
      if (next.userId !== userId) return;

      if (prev.isDirty && !next.isDirty) {
        clearUserPageDraft(userId);
        return;
      }

      if (next.isDirty) {
        scheduleWrite();
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, debounceMs, userId]);
}
