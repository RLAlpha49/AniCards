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

type DraftRecordV1 = {
  version: typeof DRAFT_STORAGE_VERSION;
  userId: string;
  savedAt: number;
  patch: LocalEditsPatch;
};

function draftStorageKey(userId: string): string {
  return `anicards:user-page-editor:draft:v${DRAFT_STORAGE_VERSION}:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    if (!isRecord(parsed)) return null;
    if (parsed.version !== DRAFT_STORAGE_VERSION) return null;
    if (parsed.userId !== userId) return null;
    if (
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt)
    ) {
      return null;
    }

    const patch = parseLocalEditsPatch(parsed.patch);
    if (!patch) return null;

    return {
      version: DRAFT_STORAGE_VERSION,
      userId,
      savedAt: parsed.savedAt,
      patch,
    };
  } catch {
    return null;
  }
}

export function clearUserPageDraft(userId: string): void {
  if (!globalThis.window) return;
  try {
    globalThis.window.localStorage.removeItem(draftStorageKey(userId));
  } catch {}
}
