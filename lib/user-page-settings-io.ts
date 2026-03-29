// Owns the import/export JSON contract for user page settings. The editor lets
// people move settings between global defaults, individual cards, and saved
// templates, so this module stays deliberately defensive: accept friendly input
// shapes, normalize them, and reject malformed payloads with user-facing errors
// instead of letting invalid JSON leak deeper into editor state.

import type {
  ColorValue,
  GradientDefinition,
  GradientStop,
} from "./types/card";
import { clampBorderRadius, DEFAULT_CARD_BORDER_RADIUS } from "./utils";

/**
 * Snapshot of visual/behavioral settings that can be applied to global settings
 * or to an individual card as an override.
 */
export interface SettingsSnapshot {
  colorPreset: string;
  colors: [ColorValue, ColorValue, ColorValue, ColorValue];
  borderEnabled: boolean;
  borderColor: string;
  borderRadius: number;
  advancedSettings: AdvancedSettingsSnapshot;
}

export interface AdvancedSettingsSnapshot {
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

export interface SettingsTemplateV1 {
  id: string;
  name: string;
  snapshot: SettingsSnapshot;
  createdAt: number;
  updatedAt: number;
}

export type SettingsExportV1 =
  | {
      schemaVersion: 1;
      scope: "global";
      exportedAt: string;
      global: SettingsSnapshot;
    }
  | {
      schemaVersion: 1;
      scope: "card";
      exportedAt: string;
      cardId?: string;
      cardLabel?: string;
      card: SettingsSnapshot;
    }
  | {
      schemaVersion: 1;
      scope: "templates";
      exportedAt: string;
      templates: SettingsTemplateV1[];
    }
  | {
      schemaVersion: 1;
      scope: "all";
      exportedAt: string;
      global: SettingsSnapshot;
      templates: SettingsTemplateV1[];
    };

export type ParsedSettingsImport =
  | { kind: "snapshot"; snapshot: SettingsSnapshot }
  | { kind: "export"; value: SettingsExportV1 };

// Large enough for realistic exports, small enough to stop accidental pastes of
// unrelated blobs from freezing the import UI.
const MAX_IMPORT_CHARS = 250_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function isGradientStop(value: unknown): value is GradientStop {
  if (!isPlainObject(value)) return false;
  if (typeof value.color !== "string") return false;
  if (!isFiniteNumber(value.offset)) return false;
  if (value.opacity !== undefined && !isFiniteNumber(value.opacity))
    return false;
  return true;
}

function isGradientDefinition(value: unknown): value is GradientDefinition {
  if (!isPlainObject(value)) return false;
  if (value.type !== "linear" && value.type !== "radial") return false;
  if (!Array.isArray(value.stops) || value.stops.length < 2) return false;
  if (!value.stops.every(isGradientStop)) return false;

  return value.type === "linear"
    ? isValidLinearGradientExtras(value)
    : isValidRadialGradientExtras(value);
}

function isValidLinearGradientExtras(value: Record<string, unknown>): boolean {
  return value.angle === undefined || isFiniteNumber(value.angle);
}

function isValidRadialGradientExtras(value: Record<string, unknown>): boolean {
  if (value.cx !== undefined && !isFiniteNumber(value.cx)) return false;
  if (value.cy !== undefined && !isFiniteNumber(value.cy)) return false;
  if (value.r !== undefined && !isFiniteNumber(value.r)) return false;
  return true;
}

function isColorValue(value: unknown): value is ColorValue {
  if (typeof value === "string") return true;
  return isGradientDefinition(value);
}

function parseAdvancedSettingsSnapshot(
  value: unknown,
): AdvancedSettingsSnapshot {
  if (!isPlainObject(value)) return {};

  const out: AdvancedSettingsSnapshot = {};

  if (typeof value.useStatusColors === "boolean") {
    out.useStatusColors = value.useStatusColors;
  }

  if (typeof value.showPiePercentages === "boolean") {
    out.showPiePercentages = value.showPiePercentages;
  }

  if (typeof value.showFavorites === "boolean") {
    out.showFavorites = value.showFavorites;
  }

  const gridCols = asFiniteNumber(value.gridCols);
  if (typeof gridCols === "number") {
    out.gridCols = Math.max(1, Math.min(5, Math.round(gridCols)));
  }

  const gridRows = asFiniteNumber(value.gridRows);
  if (typeof gridRows === "number") {
    out.gridRows = Math.max(1, Math.min(5, Math.round(gridRows)));
  }

  return out;
}

export function parseSettingsSnapshot(value: unknown): SettingsSnapshot | null {
  if (!isPlainObject(value)) return null;

  const preset =
    typeof value.colorPreset === "string" ? value.colorPreset : undefined;

  if (!Array.isArray(value.colors) || value.colors.length !== 4) return null;
  const [c0, c1, c2, c3] = value.colors;
  if (![c0, c1, c2, c3].every(isColorValue)) return null;

  const borderEnabled =
    typeof value.borderEnabled === "boolean" ? value.borderEnabled : false;
  const borderColor =
    typeof value.borderColor === "string" ? value.borderColor : "#e4e2e2";
  const borderRadius = clampBorderRadius(
    typeof value.borderRadius === "number"
      ? value.borderRadius
      : DEFAULT_CARD_BORDER_RADIUS,
  );

  const advancedSettings = parseAdvancedSettingsSnapshot(
    value.advancedSettings,
  );

  return {
    colorPreset: preset ?? "custom",
    colors: [c0, c1, c2, c3],
    borderEnabled,
    borderColor,
    borderRadius,
    advancedSettings,
  };
}

export function parseSettingsExportJson(
  raw: string,
): { ok: true; value: ParsedSettingsImport } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Expected a JSON string." };
  }
  if (raw.length > MAX_IMPORT_CHARS) {
    return {
      ok: false,
      error: `Import is too large (${raw.length} chars).`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }

  // Try the bare snapshot shape first so copied settings can round-trip even if
  // someone strips the outer export wrapper before importing again.
  const snapshot = parseSettingsSnapshot(parsed);
  if (snapshot) {
    return { ok: true, value: { kind: "snapshot", snapshot } };
  }

  const parsedExport = parseSettingsExportObject(parsed);
  if (!parsedExport.ok) return parsedExport;
  return { ok: true, value: { kind: "export", value: parsedExport.value } };
}

function parseSettingsExportObject(
  parsed: unknown,
): { ok: true; value: SettingsExportV1 } | { ok: false; error: string } {
  const baseResult = parseExportBase(parsed);
  if (!baseResult.ok) return baseResult;
  const base = baseResult.value;

  switch (base.scope) {
    case "global":
      return parseGlobalExport(base);
    case "card":
      return parseCardExport(base);
    case "templates":
      return parseTemplatesExport(base);
    case "all":
      return parseAllExport(base);
    default:
      return { ok: false, error: "Invalid scope." };
  }
}

type ParsedExportBase = {
  schemaVersion: 1;
  scope: SettingsExportV1["scope"];
  exportedAt: string;
  raw: Record<string, unknown>;
};

function parseExportBase(
  parsed: unknown,
): { ok: true; value: ParsedExportBase } | { ok: false; error: string } {
  if (!isPlainObject(parsed)) {
    return { ok: false, error: "Expected a JSON object." };
  }

  if (parsed.schemaVersion !== 1) {
    return {
      ok: false,
      error: "Unsupported settings JSON version. Expected schemaVersion=1.",
    };
  }

  const scope = parsed.scope;
  if (
    scope !== "global" &&
    scope !== "card" &&
    scope !== "templates" &&
    scope !== "all"
  ) {
    return {
      ok: false,
      error: "Invalid scope. Expected global, card, templates, or all.",
    };
  }

  const exportedAt =
    typeof parsed.exportedAt === "string"
      ? parsed.exportedAt
      : new Date().toISOString();

  return {
    ok: true,
    value: { schemaVersion: 1, scope, exportedAt, raw: parsed },
  };
}

function parseGlobalExport(
  base: ParsedExportBase,
): { ok: true; value: SettingsExportV1 } | { ok: false; error: string } {
  const global = parseSettingsSnapshot(base.raw.global);
  if (!global) return { ok: false, error: "Invalid global settings payload." };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      scope: "global",
      exportedAt: base.exportedAt,
      global,
    },
  };
}

function parseCardExport(
  base: ParsedExportBase,
): { ok: true; value: SettingsExportV1 } | { ok: false; error: string } {
  const card = parseSettingsSnapshot(base.raw.card);
  if (!card) return { ok: false, error: "Invalid card settings payload." };

  const cardId =
    typeof base.raw.cardId === "string" ? base.raw.cardId : undefined;
  const cardLabel =
    typeof base.raw.cardLabel === "string" ? base.raw.cardLabel : undefined;

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      scope: "card",
      exportedAt: base.exportedAt,
      cardId,
      cardLabel,
      card,
    },
  };
}

function parseTemplatesExport(
  base: ParsedExportBase,
): { ok: true; value: SettingsExportV1 } | { ok: false; error: string } {
  const templates = parseTemplatesPayload(base.raw.templates);
  if (!templates) return { ok: false, error: "Invalid templates payload." };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      scope: "templates",
      exportedAt: base.exportedAt,
      templates,
    },
  };
}

function parseAllExport(
  base: ParsedExportBase,
): { ok: true; value: SettingsExportV1 } | { ok: false; error: string } {
  const global = parseSettingsSnapshot(base.raw.global);
  if (!global) return { ok: false, error: "Invalid global settings payload." };

  const templates = parseTemplatesPayload(base.raw.templates);
  if (!templates) return { ok: false, error: "Invalid templates payload." };

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      scope: "all",
      exportedAt: base.exportedAt,
      global,
      templates,
    },
  };
}

function parseTemplatesPayload(v: unknown): SettingsTemplateV1[] | null {
  if (!Array.isArray(v)) return null;

  const out: SettingsTemplateV1[] = [];
  for (const item of v) {
    if (!isPlainObject(item)) return null;
    if (typeof item.id !== "string") return null;
    if (typeof item.name !== "string") return null;
    if (!isFiniteNumber(item.createdAt)) return null;
    if (!isFiniteNumber(item.updatedAt)) return null;
    const snap = parseSettingsSnapshot(item.snapshot);
    if (!snap) return null;
    out.push({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      snapshot: snap,
    });
  }

  return out;
}

type GlobalSettingsExport = Extract<SettingsExportV1, { scope: "global" }>;
type CardSettingsExport = Extract<SettingsExportV1, { scope: "card" }>;
type TemplatesSettingsExport = Extract<
  SettingsExportV1,
  { scope: "templates" }
>;
type AllSettingsExport = Extract<SettingsExportV1, { scope: "all" }>;

type GlobalSettingsExportWithoutTimestamp = Omit<
  GlobalSettingsExport,
  "exportedAt"
>;
type CardSettingsExportWithoutTimestamp = Omit<
  CardSettingsExport,
  "exportedAt"
>;
type TemplatesSettingsExportWithoutTimestamp = Omit<
  TemplatesSettingsExport,
  "exportedAt"
>;
type AllSettingsExportWithoutTimestamp = Omit<AllSettingsExport, "exportedAt">;

type SettingsExportWithoutTimestamp =
  | GlobalSettingsExportWithoutTimestamp
  | CardSettingsExportWithoutTimestamp
  | TemplatesSettingsExportWithoutTimestamp
  | AllSettingsExportWithoutTimestamp;

export function makeSettingsExport(
  value: GlobalSettingsExportWithoutTimestamp,
): GlobalSettingsExport;
export function makeSettingsExport(
  value: CardSettingsExportWithoutTimestamp,
): CardSettingsExport;
export function makeSettingsExport(
  value: TemplatesSettingsExportWithoutTimestamp,
): TemplatesSettingsExport;
export function makeSettingsExport(
  value: AllSettingsExportWithoutTimestamp,
): AllSettingsExport;
export function makeSettingsExport(
  value: SettingsExportWithoutTimestamp,
): SettingsExportV1 {
  return { ...value, exportedAt: new Date().toISOString() };
}

export function stringifySettingsExport(value: SettingsExportV1): string {
  return JSON.stringify(value, null, 2);
}
