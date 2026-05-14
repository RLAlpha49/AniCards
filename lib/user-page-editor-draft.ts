/**
 * Local draft persistence for unsaved user-page editor changes.
 *
 * Drafts are stored as validated patches instead of whole-store snapshots so
 * restore stays resilient to schema changes and ignores malformed localStorage
 * data instead of polluting the live editor state.
 */
import type { LocalEditsPatch } from "./stores/user-page-editor";
import { parseLocalEditsPatch } from "./user-page-settings-io";

const DRAFT_STORAGE_VERSION = 1 as const;
const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const EXIT_SAVE_FALLBACK_STORAGE_VERSION = 1 as const;

type DraftRecordV1 = {
  version: typeof DRAFT_STORAGE_VERSION;
  userId: string;
  savedAt: number;
  patch: LocalEditsPatch;
};

export type UserPageExitSaveFallbackReason =
  | "send_beacon_failed"
  | "send_beacon_unsupported";

export type UserPageExitSaveFallbackRecord = {
  version: typeof EXIT_SAVE_FALLBACK_STORAGE_VERSION;
  userId: string;
  savedAt: number;
  reason: UserPageExitSaveFallbackReason;
};

function draftStorageKey(userId: string): string {
  return `anicards:user-page-editor:draft:v${DRAFT_STORAGE_VERSION}:${userId}`;
}

function exitSaveFallbackStorageKey(userId: string): string {
  return `anicards:user-page-editor:exit-save-fallback:v${EXIT_SAVE_FALLBACK_STORAGE_VERSION}:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExpiredDraft(savedAt: number): boolean {
  return Date.now() - savedAt > DRAFT_MAX_AGE_MS;
}

function clearInvalidDraftRecord(userId: string): null {
  clearUserPageDraft(userId);
  clearUserPageExitSaveFallback(userId);
  return null;
}

export function writeUserPageDraft(
  userId: string,
  patch: LocalEditsPatch,
): void {
  if (!globalThis.window) return;
  try {
    const normalizedPatch = parseLocalEditsPatch(patch);
    if (!normalizedPatch) return;

    const record: DraftRecordV1 = {
      version: DRAFT_STORAGE_VERSION,
      userId,
      savedAt: Date.now(),
      patch: normalizedPatch,
    };
    globalThis.window.localStorage.setItem(
      draftStorageKey(userId),
      JSON.stringify(record),
    );
  } catch {
    // Ignore draft persistence errors (private mode/quota/etc)
  }
}

export function readUserPageDraft(userId: string): DraftRecordV1 | null {
  if (!globalThis.window) return null;

  try {
    const raw = globalThis.window.localStorage.getItem(draftStorageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return clearInvalidDraftRecord(userId);
    if (parsed.version !== DRAFT_STORAGE_VERSION) {
      return clearInvalidDraftRecord(userId);
    }
    if (parsed.userId !== userId) return clearInvalidDraftRecord(userId);
    if (
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt)
    ) {
      return clearInvalidDraftRecord(userId);
    }
    if (isExpiredDraft(parsed.savedAt)) return clearInvalidDraftRecord(userId);

    const patch = parseLocalEditsPatch(parsed.patch);
    if (!patch) return clearInvalidDraftRecord(userId);

    return {
      version: DRAFT_STORAGE_VERSION,
      userId,
      savedAt: parsed.savedAt,
      patch,
    };
  } catch {
    return clearInvalidDraftRecord(userId);
  }
}

export function clearUserPageDraft(userId: string): void {
  if (!globalThis.window) return;
  try {
    globalThis.window.localStorage.removeItem(draftStorageKey(userId));
  } catch {}
}

export function writeUserPageExitSaveFallback(
  userId: string,
  reason: UserPageExitSaveFallbackReason,
): void {
  if (!globalThis.window) return;

  try {
    const record: UserPageExitSaveFallbackRecord = {
      version: EXIT_SAVE_FALLBACK_STORAGE_VERSION,
      userId,
      savedAt: Date.now(),
      reason,
    };

    globalThis.window.localStorage.setItem(
      exitSaveFallbackStorageKey(userId),
      JSON.stringify(record),
    );
  } catch {
    // Ignore local recovery-marker persistence failures.
  }
}

export function readUserPageExitSaveFallback(
  userId: string,
): UserPageExitSaveFallbackRecord | null {
  if (!globalThis.window) return null;

  try {
    const raw = globalThis.window.localStorage.getItem(
      exitSaveFallbackStorageKey(userId),
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      clearUserPageExitSaveFallback(userId);
      return null;
    }

    if (parsed.version !== EXIT_SAVE_FALLBACK_STORAGE_VERSION) {
      clearUserPageExitSaveFallback(userId);
      return null;
    }

    if (parsed.userId !== userId) {
      clearUserPageExitSaveFallback(userId);
      return null;
    }

    if (
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      isExpiredDraft(parsed.savedAt)
    ) {
      clearUserPageExitSaveFallback(userId);
      return null;
    }

    if (
      parsed.reason !== "send_beacon_failed" &&
      parsed.reason !== "send_beacon_unsupported"
    ) {
      clearUserPageExitSaveFallback(userId);
      return null;
    }

    return {
      version: EXIT_SAVE_FALLBACK_STORAGE_VERSION,
      userId,
      savedAt: parsed.savedAt,
      reason: parsed.reason,
    };
  } catch {
    clearUserPageExitSaveFallback(userId);
    return null;
  }
}

export function clearUserPageExitSaveFallback(userId: string): void {
  if (!globalThis.window) return;

  try {
    globalThis.window.localStorage.removeItem(
      exitSaveFallbackStorageKey(userId),
    );
  } catch {}
}
