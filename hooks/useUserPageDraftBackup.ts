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
 * Flushes the current dirty editor patch into local draft storage immediately.
 * Useful as a last-chance fallback before in-app navigation or tab close.
 */
export function flushUserPageDraftBackup(
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;

  const snapshot = useUserPageEditor.getState();
  if (snapshot.userId !== userId) return false;
  if (!snapshot.isDirty) return false;

  const patch = buildLocalEditsPatch(snapshot);
  if (!patch) return false;

  writeUserPageDraft(userId, patch);
  return true;
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

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const flushDraftWrite = () => {
      clearTimer();

      flushUserPageDraftBackup(userId);
    };

    const scheduleWrite = () => {
      clearTimer();

      timerRef.current = setTimeout(() => {
        flushDraftWrite();
      }, debounceMs);
    };

    const handlePageHide = () => {
      flushDraftWrite();
    };

    const handleVisibilityChange = () => {
      if (globalThis.document.visibilityState !== "hidden") {
        return;
      }

      flushDraftWrite();
    };

    const unsubscribe = useUserPageEditor.subscribe((next, prev) => {
      if (next.userId !== userId) return;

      if (prev.isDirty && !next.isDirty) {
        clearTimer();
        clearUserPageDraft(userId);
        return;
      }

      if (next.isDirty) {
        scheduleWrite();
      }
    });

    globalThis.window.addEventListener("pagehide", handlePageHide);
    globalThis.document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      unsubscribe();

      globalThis.window.removeEventListener("pagehide", handlePageHide);
      globalThis.document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      clearTimer();
    };
  }, [enabled, debounceMs, userId]);
}
