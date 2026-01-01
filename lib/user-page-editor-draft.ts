import type { SettingsSnapshot } from "./user-page-settings-io";
import type {
  CardEditorConfig,
  LocalEditsPatch,
} from "./stores/user-page-editor";

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
  return typeof value === "object" && value !== null;
}

function isSettingsSnapshot(value: unknown): value is SettingsSnapshot {
  if (!isRecord(value)) return false;
  if (typeof value.colorPreset !== "string") return false;
  if (!Array.isArray(value.colors) || value.colors.length !== 4) return false;
  if (typeof value.borderEnabled !== "boolean") return false;
  if (typeof value.borderColor !== "string") return false;
  if (
    typeof value.borderRadius !== "number" ||
    !Number.isFinite(value.borderRadius)
  )
    return false;
  if (
    value.advancedSettings !== undefined &&
    !isRecord(value.advancedSettings)
  ) {
    return false;
  }
  return true;
}

function isCardEditorConfig(value: unknown): value is CardEditorConfig {
  if (!isRecord(value)) return false;
  if (typeof value.cardId !== "string") return false;
  if (typeof value.enabled !== "boolean") return false;
  if (typeof value.variant !== "string") return false;

  if (!isRecord(value.colorOverride)) return false;
  if (typeof value.colorOverride.useCustomSettings !== "boolean") return false;

  if (
    value.colorOverride.colorPreset !== undefined &&
    typeof value.colorOverride.colorPreset !== "string"
  ) {
    return false;
  }
  if (
    value.colorOverride.colors !== undefined &&
    !Array.isArray(value.colorOverride.colors)
  ) {
    return false;
  }

  if (!isRecord(value.advancedSettings)) return false;
  if (value.borderColor !== undefined && typeof value.borderColor !== "string")
    return false;
  if (
    value.borderRadius !== undefined &&
    typeof value.borderRadius !== "number"
  )
    return false;

  return true;
}

function isOptionalGlobalSnapshot(value: Record<string, unknown>): boolean {
  return (
    value.globalSnapshot === undefined ||
    isSettingsSnapshot(value.globalSnapshot)
  );
}

function isOptionalCardOrder(value: Record<string, unknown>): boolean {
  if (value.cardOrder === undefined) return true;
  if (!Array.isArray(value.cardOrder)) return false;
  return value.cardOrder.every((x) => typeof x === "string");
}

function isOptionalCardConfigs(value: Record<string, unknown>): boolean {
  if (value.cardConfigs === undefined) return true;
  if (!isRecord(value.cardConfigs)) return false;
  for (const cfg of Object.values(value.cardConfigs)) {
    if (!isCardEditorConfig(cfg)) return false;
  }
  return true;
}

function isLocalEditsPatch(value: unknown): value is LocalEditsPatch {
  if (!isRecord(value)) return false;
  return (
    isOptionalGlobalSnapshot(value) &&
    isOptionalCardOrder(value) &&
    isOptionalCardConfigs(value)
  );
}

export function writeUserPageDraft(
  userId: string,
  patch: LocalEditsPatch,
): void {
  if (!globalThis.window) return;
  try {
    const record: DraftRecordV1 = {
      version: DRAFT_STORAGE_VERSION,
      userId,
      savedAt: Date.now(),
      patch,
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
    if (!isLocalEditsPatch(parsed.patch)) return null;

    return parsed as DraftRecordV1;
  } catch {
    return null;
  }
}

export function clearUserPageDraft(userId: string): void {
  if (!globalThis.window) return;
  try {
    globalThis.window.localStorage.removeItem(draftStorageKey(userId));
  } catch {
    // Ignore
  }
}
