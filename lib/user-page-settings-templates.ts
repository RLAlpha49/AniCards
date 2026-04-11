import type { SettingsTemplateV1 } from "./user-page-settings-io";
import {
  makeSettingsExport,
  parseSettingsExportJson,
} from "./user-page-settings-io";

export const SETTINGS_TEMPLATES_STORAGE_KEY =
  "anicards:user-page-settings-templates:v1";

export const PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY =
  "anicards:user-page-settings-template-apply:v1";

export interface PendingSettingsTemplateApply {
  templateId: string;
  templateName?: string;
  applyTo: "global";
  source: "examples";
  queuedAt: number;
}

export type SettingsTemplatesStorageResult =
  | { ok: true }
  | { ok: false; error: string };

const SETTINGS_TEMPLATES_STORAGE_ERROR =
  "Couldn't save template changes in this browser. Check storage permissions and try again.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readSettingsTemplatesFromStorage(): SettingsTemplateV1[] {
  if (globalThis.window === undefined) return [];

  try {
    const raw = globalThis.window.localStorage.getItem(
      SETTINGS_TEMPLATES_STORAGE_KEY,
    );
    if (!raw) return [];

    const parsed = parseSettingsExportJson(raw);
    if (!parsed.ok || parsed.value.kind !== "export") return [];

    const exported = parsed.value.value;
    if (exported.scope === "templates") return exported.templates;
    if (exported.scope === "all") return exported.templates;
    return [];
  } catch {
    return [];
  }
}

export function writeSettingsTemplatesToStorage(
  templates: SettingsTemplateV1[],
): SettingsTemplatesStorageResult {
  if (globalThis.window === undefined) {
    return {
      ok: false,
      error: SETTINGS_TEMPLATES_STORAGE_ERROR,
    };
  }

  try {
    const payload = makeSettingsExport({
      schemaVersion: 1,
      scope: "templates",
      templates,
    });

    globalThis.window.localStorage.setItem(
      SETTINGS_TEMPLATES_STORAGE_KEY,
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: SETTINGS_TEMPLATES_STORAGE_ERROR,
    };
  }
}

export function upsertSettingsTemplate(
  templates: readonly SettingsTemplateV1[],
  template: SettingsTemplateV1,
): SettingsTemplateV1[] {
  const existingIndex = templates.findIndex(
    (entry) => entry.id === template.id,
  );
  if (existingIndex < 0) {
    return [...templates, template];
  }

  const existing = templates[existingIndex];
  const next = [...templates];
  next[existingIndex] = {
    ...template,
    createdAt: existing.createdAt,
  };
  return next;
}

export function upsertSettingsTemplateInStorage(
  template: SettingsTemplateV1,
):
  | { ok: true; templates: SettingsTemplateV1[] }
  | { ok: false; error: string } {
  const next = upsertSettingsTemplate(
    readSettingsTemplatesFromStorage(),
    template,
  );
  const writeResult = writeSettingsTemplatesToStorage(next);
  if (!writeResult.ok) {
    return writeResult;
  }
  return { ok: true, templates: next };
}

export function queuePendingSettingsTemplateApply(
  pending: PendingSettingsTemplateApply,
): void {
  if (globalThis.window === undefined) return;

  try {
    globalThis.window.sessionStorage.setItem(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      JSON.stringify(pending),
    );
  } catch {
    // Ignore session persistence failures.
  }
}

export function consumePendingSettingsTemplateApply(): PendingSettingsTemplateApply | null {
  if (globalThis.window === undefined) return null;

  try {
    const raw = globalThis.window.sessionStorage.getItem(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
    );
    if (!raw) return null;

    globalThis.window.sessionStorage.removeItem(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
    );

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return null;
    if (typeof parsed.templateId !== "string" || !parsed.templateId.trim()) {
      return null;
    }
    if (parsed.applyTo !== "global") return null;
    if (parsed.source !== "examples") return null;
    if (
      typeof parsed.queuedAt !== "number" ||
      !Number.isFinite(parsed.queuedAt)
    ) {
      return null;
    }

    return {
      templateId: parsed.templateId,
      templateName:
        typeof parsed.templateName === "string"
          ? parsed.templateName
          : undefined,
      applyTo: "global",
      source: "examples",
      queuedAt: parsed.queuedAt,
    };
  } catch {
    return null;
  }
}
