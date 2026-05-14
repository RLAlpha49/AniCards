"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Copy,
  Download,
  FileDown,
  FileUp,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { CopyUrlsPopover } from "@/components/user/bulk/CopyUrlsPopover";
import { DownloadPopover } from "@/components/user/bulk/DownloadPopover";
import {
  createDownloadSummary,
  DownloadStatusAlerts,
  type DownloadSummary,
} from "@/components/user/bulk/DownloadStatusAlerts";
import { statCardTypes } from "@/lib/card-types";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import {
  clearUserPageDraft,
  clearUserPageExitSaveFallback,
  readUserPageDraft,
  readUserPageExitSaveFallback,
  writeUserPageDraft,
  writeUserPageExitSaveFallback,
} from "@/lib/user-page-editor-draft";
import {
  makeSettingsExport,
  makeWorkspaceBackup,
  parseSettingsExportJson,
  parseWorkspaceBackupJson,
  type SettingsExportV1,
  type SettingsSnapshot,
  type SettingsTemplateV1,
  stringifySettingsExport,
  stringifyWorkspaceBackup,
} from "@/lib/user-page-settings-io";
import { writeSettingsTemplatesToStorage } from "@/lib/user-page-settings-templates";
import {
  type CardDownloadFormat,
  cn,
  trimOuterRepeatedCharacter,
} from "@/lib/utils";

import {
  buildShareableCards,
  copyShareableCardUrlsToClipboard,
  downloadShareableCards,
  getOrderedCardIds,
  type ShareCardUrlFormat,
} from "./share-utils";

type SettingsToolsProps =
  | {
      mode: "card";
      cardId: string;
      cardLabel: string;
      defaultExpanded?: boolean;
      onRequestedActionHandled?: (action: SettingsToolsActionRequest) => void;
      requestedAction?: SettingsToolsActionRequest | null;
      spotlightMessage?: string;
    }
  | {
      mode: "global";
      defaultExpanded?: boolean;
      onRequestedActionHandled?: (action: SettingsToolsActionRequest) => void;
      requestedAction?: SettingsToolsActionRequest | null;
      spotlightMessage?: string;
    };

export type SettingsToolsActionRequest =
  | "copy-from-card"
  | "templates"
  | "import"
  | "workspace-restore";

type SettingsToolsArea = "copy" | "templates" | "import" | "workspace";

type ExportKind = "current" | "templates" | "all";

type InlineFeedback = {
  message: string;
  tone: "error" | "success";
};

type UserPageEditorStoreState = ReturnType<typeof useUserPageEditor.getState>;
type SettingsToolsWorkspaceBackup = ReturnType<typeof makeWorkspaceBackup>;
type SettingsToolsShareBuildResult = ReturnType<typeof buildShareableCards>;
type SettingsToolsCardOption = {
  enabled: boolean;
  id: string;
  label: string;
};
type SettingsToolsShareData = Pick<
  SettingsToolsShareBuildResult,
  "shareableCards" | "skippedDisabledCards"
>;
type SettingsToolsFeedbackOutcome = {
  errorMessage?: string;
  successMessage?: string;
};
type SettingsToolsProfileShareDownloadOutcome =
  | {
      kind: "error";
      errorMessage: string;
    }
  | {
      kind: "noop";
    }
  | {
      dismissDelayMs?: number;
      kind: "summary";
      summary: DownloadSummary;
    };

type SettingsToolsStringSetter = React.Dispatch<
  React.SetStateAction<string | null>
>;
type SettingsToolsTemplateFeedbackSetter = React.Dispatch<
  React.SetStateAction<InlineFeedback | null>
>;
type SettingsToolsDownloadSummarySetter = React.Dispatch<
  React.SetStateAction<DownloadSummary | null>
>;
type SettingsToolsDownloadProgressSetter = React.Dispatch<
  React.SetStateAction<{
    current: number;
    total: number;
  }>
>;
type SettingsToolsCopiedShareFormat = ShareCardUrlFormat | "failed-list" | null;

const EMPTY_SETTINGS_TOOLS_SHARE_DATA: SettingsToolsShareData = {
  shareableCards: [],
  skippedDisabledCards: [],
};

const SETTINGS_IMPORT_EXAMPLE = JSON.stringify(
  {
    colorPreset: "custom",
    colors: ["#111111", "#222222", "#333333", "#444444"],
    borderEnabled: false,
    borderColor: "#e4e2e2",
    borderRadius: 12,
    advancedSettings: {},
  },
  null,
  2,
);

const WORKSPACE_RESTORE_EXAMPLE = JSON.stringify(
  {
    schemaVersion: 1,
    scope: "workspace",
    workspace: {
      global: {
        colorPreset: "custom",
        colors: ["#111111", "#222222", "#333333", "#444444"],
        borderEnabled: false,
        borderColor: "#e4e2e2",
        borderRadius: 12,
        advancedSettings: {},
      },
      cardConfigs: {},
      cardOrder: [],
    },
    editorState: {
      templates: [],
    },
  },
  null,
  2,
);

function clearTimeoutRef(timerRef: {
  current: ReturnType<typeof setTimeout> | null;
}) {
  if (!timerRef.current) {
    return;
  }

  clearTimeout(timerRef.current);
  timerRef.current = null;
}

function buildWorkspaceRestoreLabel(identity?: string | null): string {
  return identity
    ? `Workspace restored from ${identity}`
    : "Workspace restored";
}

function getSettingsToolsInitialExportKind(
  mode: SettingsToolsProps["mode"],
): ExportKind {
  return mode === "global" ? "all" : "current";
}

function getSettingsToolsFeedbackNode(options: {
  defaultMessage: React.ReactNode;
  errorMessage: string | null;
  successMessage: string | null;
}): React.ReactNode {
  if (options.errorMessage) {
    return <span className="text-red-600">{options.errorMessage}</span>;
  }

  if (options.successMessage) {
    return <span className="text-green-600">{options.successMessage}</span>;
  }

  return options.defaultMessage;
}

function getSettingsToolsAreaForRequest(
  request: SettingsToolsActionRequest,
): SettingsToolsArea {
  switch (request) {
    case "copy-from-card":
      return "copy";
    case "templates":
      return "templates";
    case "workspace-restore":
      return "workspace";
    case "import":
    default:
      return "import";
  }
}

function SettingsToolsJsonExampleBlock(
  props: Readonly<{
    children?: React.ReactNode;
    example: string;
    title: string;
  }>,
) {
  return (
    <div className="
      space-y-2 rounded-sm border border-gold/15 bg-gold/3 p-3 text-xs
      dark:border-gold/12
    ">
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{props.title}</p>
        {props.children}
      </div>
      <pre className="
        overflow-x-auto border border-border/60 bg-background p-3 font-mono text-[11px]
        text-foreground
      ">
        {props.example}
      </pre>
    </div>
  );
}

function TemplateFeedbackMessage(
  props: Readonly<{ feedback: InlineFeedback | null }>,
) {
  if (!props.feedback) {
    return null;
  }

  if (props.feedback.tone === "error") {
    return (
      <p role="alert" className="text-sm text-red-600">
        {props.feedback.message}
      </p>
    );
  }

  return (
    <output className="text-sm text-green-600" aria-live="polite">
      {props.feedback.message}
    </output>
  );
}

function buildExportFilename(exp: SettingsExportV1): string {
  const date = new Date(exp.exportedAt);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  switch (exp.scope) {
    case "card":
      return `anicards-card-${exp.cardId ?? "card"}-settings-${y}${m}${d}.json`;
    case "global":
      return `anicards-global-settings-${y}${m}${d}.json`;
    case "templates":
      return `anicards-settings-templates-${y}${m}${d}.json`;
    case "all":
      return `anicards-settings-all-${y}${m}${d}.json`;
  }
}

function buildWorkspaceBackupFilename(params: {
  exportedAt: string;
  userId?: string;
  username?: string;
}) {
  const date = new Date(params.exportedAt);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const identity = trimOuterRepeatedCharacter(
    (params.username || params.userId || "workspace")
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]+/g, "-"),
    "-",
  ).slice(0, 40);

  return `anicards-${identity || "workspace"}-workspace-backup-${y}${m}${d}.json`;
}

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copySettingsToolsJsonToClipboard(options: {
  buildExport: () => SettingsExportV1;
  setImportError: SettingsToolsStringSetter;
  setImportSuccess: SettingsToolsStringSetter;
}): Promise<void> {
  const exp = options.buildExport();
  const json = stringifySettingsExport(exp);

  try {
    await navigator.clipboard.writeText(json);
    options.setImportSuccess("Export copied to clipboard.");
    globalThis.setTimeout(() => options.setImportSuccess(null), 1500);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    options.setImportError(`Failed to copy: ${message}`);
    globalThis.setTimeout(() => options.setImportError(null), 2500);
  }
}

async function copySettingsToolsProfileShareUrlsWithFeedback(options: {
  format: ShareCardUrlFormat;
  profileShareCards: SettingsToolsShareBuildResult["shareableCards"];
  setCopiedShareFormat: (value: SettingsToolsCopiedShareFormat) => void;
  shareCopyTimerRef: {
    current: ReturnType<typeof setTimeout> | null;
  };
}): Promise<void> {
  if (options.profileShareCards.length === 0) {
    return;
  }

  try {
    await copyShareableCardUrlsToClipboard(
      options.profileShareCards,
      options.format,
    );
    options.setCopiedShareFormat(options.format);
    clearTimeoutRef(options.shareCopyTimerRef);
    options.shareCopyTimerRef.current = globalThis.setTimeout(() => {
      options.setCopiedShareFormat(null);
      options.shareCopyTimerRef.current = null;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy profile share URLs:", error);
  }
}

async function copySettingsToolsShareListToClipboard(options: {
  list: string[];
  setCopiedShareFormat: (value: SettingsToolsCopiedShareFormat) => void;
  shareCopyTimerRef: {
    current: ReturnType<typeof setTimeout> | null;
  };
}): Promise<void> {
  if (options.list.length === 0) {
    return;
  }

  try {
    await navigator.clipboard.writeText(options.list.join("\n"));
    options.setCopiedShareFormat("failed-list");
    clearTimeoutRef(options.shareCopyTimerRef);
    options.shareCopyTimerRef.current = globalThis.setTimeout(() => {
      options.setCopiedShareFormat(null);
      options.shareCopyTimerRef.current = null;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy share list:", error);
  }
}

async function copySettingsToolsWorkspaceBackupWithFeedback(options: {
  buildWorkspaceBackupPayload: () => SettingsToolsWorkspaceBackup | null;
  setWorkspaceImportError: SettingsToolsStringSetter;
  setWorkspaceImportSuccess: SettingsToolsStringSetter;
}): Promise<void> {
  const backup = options.buildWorkspaceBackupPayload();
  if (!backup) {
    return;
  }

  const json = stringifyWorkspaceBackup(backup);

  try {
    await navigator.clipboard.writeText(json);
    options.setWorkspaceImportSuccess("Workspace backup copied to clipboard.");
    globalThis.setTimeout(() => options.setWorkspaceImportSuccess(null), 1500);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.setWorkspaceImportError(
      `Failed to copy workspace backup: ${message}`,
    );
    globalThis.setTimeout(() => options.setWorkspaceImportError(null), 2500);
  }
}

function downloadSettingsToolsWorkspaceBackupWithFeedback(options: {
  buildWorkspaceBackupPayload: () => SettingsToolsWorkspaceBackup | null;
  setWorkspaceImportSuccess: SettingsToolsStringSetter;
}): void {
  const backup = options.buildWorkspaceBackupPayload();
  if (!backup) {
    return;
  }

  downloadJson(
    buildWorkspaceBackupFilename({
      exportedAt: backup.exportedAt,
      userId: backup.userId,
      username: backup.username,
    }),
    stringifyWorkspaceBackup(backup),
  );
  options.setWorkspaceImportSuccess("Workspace backup downloaded.");
  globalThis.setTimeout(() => options.setWorkspaceImportSuccess(null), 1500);
}

function isExportKind(value: string): value is ExportKind {
  return value === "current" || value === "templates" || value === "all";
}

function buildSettingsToolsWorkspaceBackupPayload(options: {
  cardConfigs: UserPageEditorStoreState["cardConfigs"];
  getGlobalSettingsSnapshot: UserPageEditorStoreState["getGlobalSettingsSnapshot"];
  mode: SettingsToolsProps["mode"];
  orderedCardIds: string[];
  settingsTemplates: UserPageEditorStoreState["settingsTemplates"];
  userId: UserPageEditorStoreState["userId"];
  username: UserPageEditorStoreState["username"];
}): SettingsToolsWorkspaceBackup | null {
  if (options.mode !== "global") {
    return null;
  }

  const draftRecord = options.userId ? readUserPageDraft(options.userId) : null;
  const exitSaveFallbackRecord = options.userId
    ? readUserPageExitSaveFallback(options.userId)
    : null;

  return makeWorkspaceBackup({
    userId: options.userId,
    username: options.username,
    workspace: {
      global: options.getGlobalSettingsSnapshot(),
      cardConfigs: options.cardConfigs,
      cardOrder: options.orderedCardIds,
    },
    editorState: {
      templates: options.settingsTemplates,
      draft: draftRecord
        ? {
            savedAt: draftRecord.savedAt,
            patch: draftRecord.patch,
          }
        : null,
      exitSaveFallback: exitSaveFallbackRecord
        ? {
            savedAt: exitSaveFallbackRecord.savedAt,
            reason: exitSaveFallbackRecord.reason,
          }
        : null,
    },
  });
}

function buildSettingsToolsCurrentExport(options: {
  getCardSettingsSnapshot: UserPageEditorStoreState["getCardSettingsSnapshot"];
  getGlobalSettingsSnapshot: UserPageEditorStoreState["getGlobalSettingsSnapshot"];
  props: Readonly<SettingsToolsProps>;
}): SettingsExportV1 {
  if (options.props.mode === "global") {
    const global = options.getGlobalSettingsSnapshot();
    return makeSettingsExport({ schemaVersion: 1, scope: "global", global });
  }

  const card = options.getCardSettingsSnapshot(options.props.cardId);
  return makeSettingsExport({
    schemaVersion: 1,
    scope: "card",
    cardId: options.props.cardId,
    cardLabel: options.props.cardLabel,
    card,
  });
}

function buildSettingsToolsExport(options: {
  currentExport: SettingsExportV1;
  exportKind: ExportKind;
  exportSettingsTemplates: UserPageEditorStoreState["exportSettingsTemplates"];
  getGlobalSettingsSnapshot: UserPageEditorStoreState["getGlobalSettingsSnapshot"];
  settingsTemplates: UserPageEditorStoreState["settingsTemplates"];
}): SettingsExportV1 {
  if (options.exportKind === "templates") {
    return options.exportSettingsTemplates();
  }

  if (options.exportKind === "all") {
    return makeSettingsExport({
      schemaVersion: 1,
      scope: "all",
      global: options.getGlobalSettingsSnapshot(),
      templates: options.settingsTemplates,
    });
  }

  return options.currentExport;
}

function applyImportedSettingsExport(options: {
  applySnapshotToTarget: (snapshot: SettingsSnapshot) => void;
  exp: SettingsExportV1;
  importSettingsTemplates: UserPageEditorStoreState["importSettingsTemplates"];
}): SettingsToolsFeedbackOutcome {
  switch (options.exp.scope) {
    case "templates": {
      const importResult = options.importSettingsTemplates(
        options.exp.templates,
      );
      return importResult.ok
        ? {
            successMessage: `Imported ${options.exp.templates.length} template(s).`,
          }
        : { errorMessage: importResult.error };
    }

    case "all": {
      options.applySnapshotToTarget(options.exp.global);
      const importResult = options.importSettingsTemplates(
        options.exp.templates,
      );

      return importResult.ok
        ? { successMessage: "Imported global settings + templates." }
        : {
            errorMessage: `Imported settings applied, but ${importResult.error}`,
          };
    }

    case "global":
      options.applySnapshotToTarget(options.exp.global);
      return { successMessage: "Imported settings applied." };

    case "card":
      options.applySnapshotToTarget(options.exp.card);
      return { successMessage: "Imported settings applied." };
  }
}

function restoreSettingsToolsWorkspaceBackup(options: {
  applyLocalEditsPatch: UserPageEditorStoreState["applyLocalEditsPatch"];
  applySettingsSnapshotToGlobal: UserPageEditorStoreState["applySettingsSnapshotToGlobal"];
  raw: string;
  userId: UserPageEditorStoreState["userId"];
}): SettingsToolsFeedbackOutcome {
  const parsed = parseWorkspaceBackupJson(options.raw);
  if (!parsed.ok) {
    return { errorMessage: parsed.error };
  }

  const backup = parsed.value;
  options.applySettingsSnapshotToGlobal(backup.workspace.global);
  options.applyLocalEditsPatch({
    cardConfigs: backup.workspace.cardConfigs,
    cardOrder: backup.workspace.cardOrder,
  });

  const persistTemplatesResult = writeSettingsTemplatesToStorage(
    backup.editorState.templates,
  );
  if (persistTemplatesResult.ok) {
    useUserPageEditor.setState({
      settingsTemplates: backup.editorState.templates,
    });
  }

  if (options.userId) {
    if (backup.editorState.draft) {
      writeUserPageDraft(options.userId, backup.editorState.draft.patch);
    } else {
      clearUserPageDraft(options.userId);
    }

    if (backup.editorState.exitSaveFallback) {
      writeUserPageExitSaveFallback(
        options.userId,
        backup.editorState.exitSaveFallback.reason,
      );
    } else {
      clearUserPageExitSaveFallback(options.userId);
    }
  }

  const restoreLabel = buildWorkspaceRestoreLabel(
    backup.username ?? backup.userId,
  );

  return persistTemplatesResult.ok
    ? { successMessage: `${restoreLabel}.` }
    : {
        errorMessage: `${restoreLabel}, but ${persistTemplatesResult.error}`,
      };
}

function getSettingsToolsTemplateSnapshot(options: {
  getCardSettingsSnapshot: UserPageEditorStoreState["getCardSettingsSnapshot"];
  getGlobalSettingsSnapshot: UserPageEditorStoreState["getGlobalSettingsSnapshot"];
  props: Readonly<SettingsToolsProps>;
}): SettingsSnapshot {
  return options.props.mode === "global"
    ? options.getGlobalSettingsSnapshot()
    : options.getCardSettingsSnapshot(options.props.cardId);
}

function getSettingsToolsExportKindOptions(
  mode: SettingsToolsProps["mode"],
): Array<{ label: string; value: ExportKind }> {
  const base: Array<{ label: string; value: ExportKind }> = [
    {
      value: "current",
      label: mode === "global" ? "Global settings" : "This card settings",
    },
    { value: "templates", label: "Templates" },
  ];

  if (mode === "global") {
    base.push({ value: "all", label: "Global + templates" });
  }

  return base;
}

function getSettingsToolsCardOptions(options: {
  cardConfigs: UserPageEditorStoreState["cardConfigs"];
  props: Readonly<SettingsToolsProps>;
}): SettingsToolsCardOption[] {
  if (options.props.mode !== "card") {
    return [];
  }

  const { cardId } = options.props;
  const metaById = new Map(statCardTypes.map((t) => [t.id, t] as const));

  return Object.values(options.cardConfigs)
    .filter((config) => config.cardId !== cardId)
    .map((config) => {
      const meta = metaById.get(config.cardId);
      return {
        id: config.cardId,
        label: meta?.label ?? config.cardId,
        enabled: config.enabled,
      };
    })
    .sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

function getSettingsToolsProfileShareData(options: {
  cardConfigs: UserPageEditorStoreState["cardConfigs"];
  getEffectiveBorderColor: UserPageEditorStoreState["getEffectiveBorderColor"];
  getEffectiveBorderRadius: UserPageEditorStoreState["getEffectiveBorderRadius"];
  getEffectiveColors: UserPageEditorStoreState["getEffectiveColors"];
  globalAdvancedSettings: UserPageEditorStoreState["globalAdvancedSettings"];
  globalColorPreset: UserPageEditorStoreState["globalColorPreset"];
  mode: SettingsToolsProps["mode"];
  orderedCardIds: string[];
  userId: UserPageEditorStoreState["userId"];
}): SettingsToolsShareData {
  if (options.mode !== "global") {
    return EMPTY_SETTINGS_TOOLS_SHARE_DATA;
  }

  return buildShareableCards({
    cardConfigs: options.cardConfigs,
    cardIds: options.orderedCardIds,
    getEffectiveBorderColor: options.getEffectiveBorderColor,
    getEffectiveBorderRadius: options.getEffectiveBorderRadius,
    getEffectiveColors: options.getEffectiveColors,
    globalAdvancedSettings: options.globalAdvancedSettings,
    globalColorPreset: options.globalColorPreset,
    userId: options.userId,
  });
}

function applySettingsToolsSnapshotToTarget(options: {
  applySettingsSnapshotToCard: UserPageEditorStoreState["applySettingsSnapshotToCard"];
  applySettingsSnapshotToGlobal: UserPageEditorStoreState["applySettingsSnapshotToGlobal"];
  props: Readonly<SettingsToolsProps>;
  snapshot: SettingsSnapshot;
}): void {
  if (options.props.mode === "global") {
    options.applySettingsSnapshotToGlobal(options.snapshot);
    return;
  }

  options.applySettingsSnapshotToCard(options.props.cardId, options.snapshot);
}

function applySettingsToolsTemplateToTarget(options: {
  applySettingsTemplateToCard: UserPageEditorStoreState["applySettingsTemplateToCard"];
  applySettingsTemplateToGlobal: UserPageEditorStoreState["applySettingsTemplateToGlobal"];
  props: Readonly<SettingsToolsProps>;
  selectedTemplateId: string;
}): void {
  if (!options.selectedTemplateId) {
    return;
  }

  if (options.props.mode === "global") {
    options.applySettingsTemplateToGlobal(options.selectedTemplateId);
    return;
  }

  options.applySettingsTemplateToCard(
    options.props.cardId,
    options.selectedTemplateId,
  );
}

function copySettingsToolsFromSelectedCard(options: {
  copyFromCardId: string;
  copySettingsFromCard: UserPageEditorStoreState["copySettingsFromCard"];
  props: Readonly<SettingsToolsProps>;
}): void {
  if (options.props.mode !== "card" || !options.copyFromCardId) {
    return;
  }

  options.copySettingsFromCard(options.copyFromCardId, options.props.cardId);
}

async function downloadSettingsToolsProfileShareCards(options: {
  format: CardDownloadFormat;
  onProgress: (progress: { current: number; total: number }) => void;
  profileShareCards: SettingsToolsShareBuildResult["shareableCards"];
  requestedTotal: number;
  skippedDisabledCards: SettingsToolsShareBuildResult["skippedDisabledCards"];
}): Promise<SettingsToolsProfileShareDownloadOutcome> {
  const skippedDisabledRawTypes = options.skippedDisabledCards.map(
    (card) => card.rawType,
  );
  const hasShareCards = options.profileShareCards.length > 0;

  if (!hasShareCards && skippedDisabledRawTypes.length === 0) {
    return { kind: "noop" };
  }

  if (!hasShareCards) {
    return {
      kind: "summary",
      summary: createDownloadSummary({
        requestedTotal: options.requestedTotal,
        skippedDisabledCardRawTypes: skippedDisabledRawTypes,
      }),
    };
  }

  try {
    const result = await downloadShareableCards({
      cards: options.profileShareCards,
      format: options.format,
      onProgress: options.onProgress,
    });
    const failedRawTypes =
      result.failedCards?.map((card) => card.rawType || card.type) ?? [];
    const summary = createDownloadSummary({
      requestedTotal: options.requestedTotal,
      exported: result.exported,
      failed: result.failed,
      failedCardRawTypes: failedRawTypes,
      skippedDisabledCardRawTypes: skippedDisabledRawTypes,
    });

    return {
      kind: "summary",
      summary,
      dismissDelayMs: summary.failed > 0 ? 10000 : 5000,
    };
  } catch (error) {
    return {
      kind: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function applySettingsToolsImportString(options: {
  applyImportedExport: (exp: SettingsExportV1) => void;
  applySnapshotToTarget: (snapshot: SettingsSnapshot) => void;
  raw: string;
  setImportError: SettingsToolsStringSetter;
  setImportSuccess: SettingsToolsStringSetter;
  setTemplateFeedback: SettingsToolsTemplateFeedbackSetter;
}): void {
  options.setImportError(null);
  options.setImportSuccess(null);
  options.setTemplateFeedback(null);

  const parsed = parseSettingsExportJson(options.raw);
  if (!parsed.ok) {
    options.setImportError(parsed.error);
    return;
  }

  if (parsed.value.kind === "snapshot") {
    options.applySnapshotToTarget(parsed.value.snapshot);
    options.setImportSuccess("Imported settings applied.");
    return;
  }

  options.applyImportedExport(parsed.value.value);
}

async function readSettingsToolsImportFile(options: {
  file: File;
  onImportText: (raw: string) => void;
  setImportError: SettingsToolsStringSetter;
}): Promise<void> {
  options.setImportError(null);

  try {
    const text = await options.file.text();
    options.onImportText(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.setImportError(`Failed to read file: ${message}`);
  }
}

function applySettingsToolsWorkspaceImportString(options: {
  applyLocalEditsPatch: UserPageEditorStoreState["applyLocalEditsPatch"];
  applySettingsSnapshotToGlobal: UserPageEditorStoreState["applySettingsSnapshotToGlobal"];
  raw: string;
  setWorkspaceImportError: SettingsToolsStringSetter;
  setWorkspaceImportSuccess: SettingsToolsStringSetter;
  userId: UserPageEditorStoreState["userId"];
}): void {
  options.setWorkspaceImportError(null);
  options.setWorkspaceImportSuccess(null);

  const outcome = restoreSettingsToolsWorkspaceBackup({
    raw: options.raw,
    userId: options.userId,
    applySettingsSnapshotToGlobal: options.applySettingsSnapshotToGlobal,
    applyLocalEditsPatch: options.applyLocalEditsPatch,
  });

  if (outcome.successMessage) {
    options.setWorkspaceImportSuccess(outcome.successMessage);
    return;
  }

  options.setWorkspaceImportError(
    outcome.errorMessage ?? "Workspace restore failed.",
  );
}

async function readSettingsToolsWorkspaceImportFile(options: {
  file: File;
  onImportText: (raw: string) => void;
  setWorkspaceImportError: SettingsToolsStringSetter;
}): Promise<void> {
  options.setWorkspaceImportError(null);

  try {
    const text = await options.file.text();
    options.onImportText(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.setWorkspaceImportError(`Failed to read file: ${message}`);
  }
}

function saveSettingsToolsTemplate(options: {
  createSettingsTemplate: UserPageEditorStoreState["createSettingsTemplate"];
  getCardSettingsSnapshot: UserPageEditorStoreState["getCardSettingsSnapshot"];
  getGlobalSettingsSnapshot: UserPageEditorStoreState["getGlobalSettingsSnapshot"];
  props: Readonly<SettingsToolsProps>;
  setImportError: SettingsToolsStringSetter;
  setImportSuccess: SettingsToolsStringSetter;
  setTemplateFeedback: SettingsToolsTemplateFeedbackSetter;
  setTemplateName: (value: string) => void;
  templateName: string;
}): void {
  const trimmed = options.templateName.trim();
  if (!trimmed) {
    return;
  }

  options.setImportError(null);
  options.setImportSuccess(null);
  options.setTemplateFeedback(null);

  const snapshot = getSettingsToolsTemplateSnapshot({
    props: options.props,
    getGlobalSettingsSnapshot: options.getGlobalSettingsSnapshot,
    getCardSettingsSnapshot: options.getCardSettingsSnapshot,
  });

  const createResult = options.createSettingsTemplate(trimmed, snapshot);
  if (!createResult.ok) {
    options.setTemplateFeedback({
      message: createResult.error,
      tone: "error",
    });
    return;
  }

  options.setTemplateName("");
  options.setTemplateFeedback({
    message: `Saved template "${trimmed.slice(0, 80)}".`,
    tone: "success",
  });
}

function deleteSettingsToolsTemplate(options: {
  deleteSettingsTemplate: UserPageEditorStoreState["deleteSettingsTemplate"];
  selectedTemplateId: string;
  setImportError: SettingsToolsStringSetter;
  setImportSuccess: SettingsToolsStringSetter;
  setSelectedTemplateId: (value: string) => void;
  setTemplateFeedback: SettingsToolsTemplateFeedbackSetter;
  templateOptions: SettingsTemplateV1[];
}): void {
  if (!options.selectedTemplateId) {
    return;
  }

  options.setImportError(null);
  options.setImportSuccess(null);
  options.setTemplateFeedback(null);

  const selectedTemplateName =
    options.templateOptions.find(
      (template) => template.id === options.selectedTemplateId,
    )?.name ?? "template";
  const deleteResult = options.deleteSettingsTemplate(
    options.selectedTemplateId,
  );

  if (!deleteResult.ok) {
    options.setTemplateFeedback({
      message: deleteResult.error,
      tone: "error",
    });
    return;
  }

  options.setSelectedTemplateId("");
  options.setTemplateFeedback({
    message: `Deleted template "${selectedTemplateName}".`,
    tone: "success",
  });
}

async function downloadSettingsToolsProfileShareCardsWithFeedback(options: {
  format: CardDownloadFormat;
  isShareDownloading: boolean;
  orderedCardIds: string[];
  profileShareCards: SettingsToolsShareBuildResult["shareableCards"];
  profileShareSkippedDisabledCards: SettingsToolsShareBuildResult["skippedDisabledCards"];
  setIsShareDownloading: (value: boolean) => void;
  setShareDownloadError: SettingsToolsStringSetter;
  setShareDownloadProgress: SettingsToolsDownloadProgressSetter;
  setShareDownloadSummary: SettingsToolsDownloadSummarySetter;
  shareDownloadSummaryTimerRef: {
    current: ReturnType<typeof setTimeout> | null;
  };
}): Promise<void> {
  if (options.isShareDownloading) {
    return;
  }

  clearTimeoutRef(options.shareDownloadSummaryTimerRef);
  options.setShareDownloadSummary(null);
  options.setShareDownloadError(null);

  const shouldTrackDownloadProgress = options.profileShareCards.length > 0;
  if (shouldTrackDownloadProgress) {
    options.setIsShareDownloading(true);
    options.setShareDownloadProgress({
      current: 0,
      total: options.profileShareCards.length,
    });
  }

  const result = await downloadSettingsToolsProfileShareCards({
    profileShareCards: options.profileShareCards,
    skippedDisabledCards: options.profileShareSkippedDisabledCards,
    requestedTotal: options.orderedCardIds.length,
    format: options.format,
    onProgress: (progress) => {
      options.setShareDownloadProgress({
        current: progress.current,
        total: progress.total,
      });
    },
  });

  if (result.kind === "summary") {
    options.setShareDownloadSummary(result.summary);
    if (result.dismissDelayMs) {
      options.shareDownloadSummaryTimerRef.current = globalThis.setTimeout(
        () => {
          options.setShareDownloadSummary(null);
          options.shareDownloadSummaryTimerRef.current = null;
        },
        result.dismissDelayMs,
      );
    }
  } else if (result.kind === "error") {
    options.setShareDownloadError(result.errorMessage);
  }

  if (shouldTrackDownloadProgress) {
    options.setIsShareDownloading(false);
  }
}

export function SettingsTools(props: Readonly<SettingsToolsProps>) {
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [copyFromCardId, setCopyFromCardId] = useState<string>("");

  const [exportKind, setExportKind] = useState<ExportKind>(
    getSettingsToolsInitialExportKind(props.mode),
  );

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [workspaceImportOpen, setWorkspaceImportOpen] = useState(false);
  const [workspaceImportText, setWorkspaceImportText] = useState("");
  const [workspaceImportError, setWorkspaceImportError] = useState<
    string | null
  >(null);
  const [workspaceImportSuccess, setWorkspaceImportSuccess] = useState<
    string | null
  >(null);
  const [templateFeedback, setTemplateFeedback] =
    useState<InlineFeedback | null>(null);
  const [copiedShareFormat, setCopiedShareFormat] =
    useState<SettingsToolsCopiedShareFormat>(null);
  const [isShareDownloading, setIsShareDownloading] = useState(false);
  const [shareDownloadProgress, setShareDownloadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [shareDownloadSummary, setShareDownloadSummary] =
    useState<DownloadSummary | null>(null);
  const [shareDownloadError, setShareDownloadError] = useState<string | null>(
    null,
  );

  const [isExpanded, setIsExpanded] = useState(
    props.mode === "global" || Boolean(props.defaultExpanded),
  );
  const [highlightedArea, setHighlightedArea] =
    useState<SettingsToolsArea | null>(null);
  const shareCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareDownloadSummaryTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copySectionRef = useRef<HTMLDivElement | null>(null);
  const templatesSectionRef = useRef<HTMLDivElement | null>(null);
  const importSectionRef = useRef<HTMLDivElement | null>(null);
  const workspaceSectionRef = useRef<HTMLDivElement | null>(null);

  const {
    userId,
    username,
    cardConfigs,
    cardOrder,
    globalColorPreset,
    globalAdvancedSettings,
    settingsTemplates,
    getGlobalSettingsSnapshot,
    getCardSettingsSnapshot,
    getEffectiveColors,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
    applySettingsSnapshotToGlobal,
    applySettingsSnapshotToCard,
    applyLocalEditsPatch,
    copySettingsFromCard,
    createSettingsTemplate,
    deleteSettingsTemplate,
    applySettingsTemplateToGlobal,
    applySettingsTemplateToCard,
    importSettingsTemplates,
    exportSettingsTemplates,
  } = useUserPageEditor(
    useShallow((s) => ({
      userId: s.userId,
      username: s.username,
      cardConfigs: s.cardConfigs,
      cardOrder: s.cardOrder,
      globalColorPreset: s.globalColorPreset,
      globalAdvancedSettings: s.globalAdvancedSettings,
      settingsTemplates: s.settingsTemplates,
      getGlobalSettingsSnapshot: s.getGlobalSettingsSnapshot,
      getCardSettingsSnapshot: s.getCardSettingsSnapshot,
      getEffectiveColors: s.getEffectiveColors,
      getEffectiveBorderColor: s.getEffectiveBorderColor,
      getEffectiveBorderRadius: s.getEffectiveBorderRadius,
      applySettingsSnapshotToGlobal: s.applySettingsSnapshotToGlobal,
      applySettingsSnapshotToCard: s.applySettingsSnapshotToCard,
      applyLocalEditsPatch: s.applyLocalEditsPatch,
      copySettingsFromCard: s.copySettingsFromCard,
      createSettingsTemplate: s.createSettingsTemplate,
      deleteSettingsTemplate: s.deleteSettingsTemplate,
      applySettingsTemplateToGlobal: s.applySettingsTemplateToGlobal,
      applySettingsTemplateToCard: s.applySettingsTemplateToCard,
      importSettingsTemplates: s.importSettingsTemplates,
      exportSettingsTemplates: s.exportSettingsTemplates,
    })),
  );

  useEffect(() => {
    return () => {
      clearTimeoutRef(shareCopyTimerRef);
      clearTimeoutRef(shareDownloadSummaryTimerRef);
      clearTimeoutRef(highlightTimerRef);
    };
  }, []);

  useEffect(() => {
    if (!props.defaultExpanded) {
      return;
    }

    setIsExpanded(true);
  }, [props.defaultExpanded]);

  const highlightArea = useCallback((area: SettingsToolsArea) => {
    setHighlightedArea(area);
    clearTimeoutRef(highlightTimerRef);
    highlightTimerRef.current = globalThis.setTimeout(() => {
      setHighlightedArea(null);
      highlightTimerRef.current = null;
    }, 2500);
  }, []);

  const focusToolArea = useCallback((area: SettingsToolsArea) => {
    const targetMap: Record<SettingsToolsArea, HTMLDivElement | null> = {
      copy: copySectionRef.current,
      templates: templatesSectionRef.current,
      import: importSectionRef.current,
      workspace: workspaceSectionRef.current,
    };

    const target = targetMap[area];
    if (!target) {
      return;
    }

    target.scrollIntoView({ block: "nearest" });
    const focusTarget = target.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [role="combobox"]',
    );
    focusTarget?.focus();
  }, []);

  const revealToolArea = useCallback(
    (area: SettingsToolsArea) => {
      setIsExpanded(true);
      highlightArea(area);

      globalThis.setTimeout(() => {
        focusToolArea(area);
      }, 0);
    },
    [focusToolArea, highlightArea],
  );

  useEffect(() => {
    const requestedAction = props.requestedAction;
    if (!requestedAction) {
      return;
    }

    const area = getSettingsToolsAreaForRequest(requestedAction);
    revealToolArea(area);

    if (requestedAction === "import") {
      setImportOpen(true);
    }

    if (requestedAction === "workspace-restore" && props.mode === "global") {
      setWorkspaceImportOpen(true);
    }

    props.onRequestedActionHandled?.(requestedAction);
  }, [props, revealToolArea]);

  const templateOptions = useMemo(() => {
    return [...settingsTemplates].sort((a, b) => a.name.localeCompare(b.name));
  }, [settingsTemplates]);

  const cardOptions = useMemo(() => {
    return getSettingsToolsCardOptions({
      cardConfigs,
      props,
    });
  }, [cardConfigs, props]);

  const feedbackNode = getSettingsToolsFeedbackNode({
    errorMessage: importError,
    successMessage: importSuccess,
    defaultMessage: (
      <span className="text-muted-foreground">
        Exported JSON is safe to share (no secrets), but it may reveal your
        styling preferences.
      </span>
    ),
  });

  const workspaceFeedbackNode = getSettingsToolsFeedbackNode({
    errorMessage: workspaceImportError,
    successMessage: workspaceImportSuccess,
    defaultMessage: (
      <span className="text-muted-foreground">
        Full workspace backups stay local to your browser and include global
        settings, per-card configs, ordering, templates, and local recovery
        state.
      </span>
    ),
  });

  const templateFeedbackNode = (
    <TemplateFeedbackMessage feedback={templateFeedback} />
  );

  const orderedCardIds = useMemo(() => {
    return getOrderedCardIds({
      cardConfigs,
      cardOrder,
    });
  }, [cardConfigs, cardOrder]);

  const {
    shareableCards: profileShareCards,
    skippedDisabledCards: profileShareSkippedDisabledCards,
  } = useMemo(() => {
    return getSettingsToolsProfileShareData({
      cardConfigs,
      getEffectiveBorderColor,
      getEffectiveBorderRadius,
      getEffectiveColors,
      globalAdvancedSettings,
      globalColorPreset,
      mode: props.mode,
      orderedCardIds,
      userId,
    });
  }, [
    cardConfigs,
    getEffectiveBorderColor,
    getEffectiveBorderRadius,
    getEffectiveColors,
    globalAdvancedSettings,
    globalColorPreset,
    orderedCardIds,
    props.mode,
    userId,
  ]);

  const buildWorkspaceBackupPayload = useCallback(() => {
    return buildSettingsToolsWorkspaceBackupPayload({
      mode: props.mode,
      userId,
      username,
      cardConfigs,
      orderedCardIds,
      settingsTemplates,
      getGlobalSettingsSnapshot,
    });
  }, [
    cardConfigs,
    getGlobalSettingsSnapshot,
    orderedCardIds,
    props.mode,
    settingsTemplates,
    userId,
    username,
  ]);

  const buildCurrentExport = useCallback((): SettingsExportV1 => {
    return buildSettingsToolsCurrentExport({
      props,
      getGlobalSettingsSnapshot,
      getCardSettingsSnapshot,
    });
  }, [getCardSettingsSnapshot, getGlobalSettingsSnapshot, props]);

  const buildExport = useCallback((): SettingsExportV1 => {
    return buildSettingsToolsExport({
      currentExport: buildCurrentExport(),
      exportKind,
      exportSettingsTemplates,
      getGlobalSettingsSnapshot,
      settingsTemplates,
    });
  }, [
    buildCurrentExport,
    exportKind,
    exportSettingsTemplates,
    getGlobalSettingsSnapshot,
    settingsTemplates,
  ]);

  const handleCopyJson = useCallback(
    () =>
      copySettingsToolsJsonToClipboard({
        buildExport,
        setImportError,
        setImportSuccess,
      }),
    [buildExport],
  );

  const handleDownloadJson = useCallback(() => {
    const exp = buildExport();
    const json = stringifySettingsExport(exp);
    downloadJson(buildExportFilename(exp), json);
  }, [buildExport]);

  const handleCopyProfileShareUrls = useCallback(
    (format: ShareCardUrlFormat = "url") =>
      copySettingsToolsProfileShareUrlsWithFeedback({
        format,
        profileShareCards,
        setCopiedShareFormat,
        shareCopyTimerRef,
      }),
    [profileShareCards],
  );

  const handleCopyShareList = useCallback(
    (list: string[]) =>
      copySettingsToolsShareListToClipboard({
        list,
        setCopiedShareFormat,
        shareCopyTimerRef,
      }),
    [],
  );

  const handleDownloadProfileShareCards = useCallback(
    (format: CardDownloadFormat = "png") =>
      downloadSettingsToolsProfileShareCardsWithFeedback({
        format,
        isShareDownloading,
        orderedCardIds,
        profileShareCards,
        profileShareSkippedDisabledCards,
        setIsShareDownloading,
        setShareDownloadError,
        setShareDownloadProgress,
        setShareDownloadSummary,
        shareDownloadSummaryTimerRef,
      }),
    [
      isShareDownloading,
      orderedCardIds,
      profileShareCards,
      profileShareSkippedDisabledCards,
      setIsShareDownloading,
      setShareDownloadError,
      setShareDownloadProgress,
      setShareDownloadSummary,
    ],
  );

  const handleCopyWorkspaceBackup = useCallback(
    () =>
      copySettingsToolsWorkspaceBackupWithFeedback({
        buildWorkspaceBackupPayload,
        setWorkspaceImportError,
        setWorkspaceImportSuccess,
      }),
    [buildWorkspaceBackupPayload],
  );

  const handleDownloadWorkspaceBackup = useCallback(
    () =>
      downloadSettingsToolsWorkspaceBackupWithFeedback({
        buildWorkspaceBackupPayload,
        setWorkspaceImportSuccess,
      }),
    [buildWorkspaceBackupPayload],
  );

  const applySnapshotToTarget = useCallback(
    (snapshot: SettingsSnapshot) => {
      applySettingsToolsSnapshotToTarget({
        applySettingsSnapshotToCard,
        applySettingsSnapshotToGlobal,
        props,
        snapshot,
      });
    },
    [applySettingsSnapshotToCard, applySettingsSnapshotToGlobal, props],
  );

  const applyImportedExport = useCallback(
    (exp: SettingsExportV1) => {
      const outcome = applyImportedSettingsExport({
        exp,
        applySnapshotToTarget,
        importSettingsTemplates,
      });

      if (outcome.errorMessage) {
        setImportError(outcome.errorMessage);
        return;
      }

      if (outcome.successMessage) {
        setImportSuccess(outcome.successMessage);
      }
    },
    [applySnapshotToTarget, importSettingsTemplates],
  );

  const handleImportString = useCallback(
    (raw: string) => {
      applySettingsToolsImportString({
        applyImportedExport,
        applySnapshotToTarget,
        raw,
        setImportError,
        setImportSuccess,
        setTemplateFeedback,
      });
    },
    [applyImportedExport, applySnapshotToTarget],
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      await readSettingsToolsImportFile({
        file,
        onImportText: handleImportString,
        setImportError,
      });
    },
    [handleImportString],
  );

  const handleWorkspaceImportString = useCallback(
    (raw: string) => {
      applySettingsToolsWorkspaceImportString({
        raw,
        userId,
        applyLocalEditsPatch,
        applySettingsSnapshotToGlobal,
        setWorkspaceImportError,
        setWorkspaceImportSuccess,
      });
    },
    [applyLocalEditsPatch, applySettingsSnapshotToGlobal, userId],
  );

  const handleWorkspaceImportFile = useCallback(
    async (file: File) => {
      await readSettingsToolsWorkspaceImportFile({
        file,
        onImportText: handleWorkspaceImportString,
        setWorkspaceImportError,
      });
    },
    [handleWorkspaceImportString],
  );

  const handleSaveTemplate = useCallback(() => {
    saveSettingsToolsTemplate({
      createSettingsTemplate,
      getCardSettingsSnapshot,
      getGlobalSettingsSnapshot,
      props,
      setImportError,
      setImportSuccess,
      setTemplateFeedback,
      setTemplateName,
      templateName,
    });
  }, [
    createSettingsTemplate,
    getCardSettingsSnapshot,
    getGlobalSettingsSnapshot,
    props,
    templateName,
  ]);

  const handleDeleteTemplate = useCallback(() => {
    deleteSettingsToolsTemplate({
      deleteSettingsTemplate,
      selectedTemplateId,
      setImportError,
      setImportSuccess,
      setSelectedTemplateId,
      setTemplateFeedback,
      templateOptions,
    });
  }, [deleteSettingsTemplate, selectedTemplateId, templateOptions]);

  const handleApplyTemplate = useCallback(() => {
    applySettingsToolsTemplateToTarget({
      applySettingsTemplateToCard,
      applySettingsTemplateToGlobal,
      props,
      selectedTemplateId,
    });
  }, [
    applySettingsTemplateToCard,
    applySettingsTemplateToGlobal,
    props,
    selectedTemplateId,
  ]);

  const handleCopyFromCard = useCallback(() => {
    copySettingsToolsFromSelectedCard({
      copyFromCardId,
      copySettingsFromCard,
      props,
    });
  }, [copyFromCardId, copySettingsFromCard, props]);

  const exportKindOptions = useMemo(() => {
    return getSettingsToolsExportKindOptions(props.mode);
  }, [props.mode]);
  const isCardMode = props.mode === "card";
  const isGlobalMode = props.mode === "global";

  const handleExportKindChange = useCallback((value: string) => {
    if (!isExportKind(value)) return;
    setExportKind(value);
  }, []);

  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm transition-colors">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="
          flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors
          hover:bg-muted/40
        "
      >
        <div className="flex items-center gap-2.5">
          <div className="
            flex size-7 items-center justify-center bg-gold/10 text-gold
            dark:bg-gold/15
          ">
            <Wrench className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Settings Tools
            </span>
            <p className="text-[11px] text-muted-foreground">
              Share, backup, templates, import &amp; export
            </p>
          </div>
        </div>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-90",
          )}
        />
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="tools-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-border/40 p-4">
              {props.spotlightMessage ? (
                <div className="
                  rounded-sm border border-gold/20 bg-gold/4 p-3 text-xs text-muted-foreground
                  dark:border-gold/12
                ">
                  <p className="font-semibold text-foreground">
                    Guided next steps
                  </p>
                  <p className="mt-1">{props.spotlightMessage}</p>
                </div>
              ) : null}

              {/* ── Copy from Card ─────────────────────────── */}
              {isCardMode && (
                <SettingsToolsCopyFromCardSection
                  cardOptions={cardOptions}
                  copyFromCardId={copyFromCardId}
                  highlighted={highlightedArea === "copy"}
                  onCopyFromCard={handleCopyFromCard}
                  onCopyFromCardIdChange={setCopyFromCardId}
                  sectionRef={copySectionRef}
                />
              )}

              {/* ── Templates ─────────────────────────────── */}
              <SettingsToolsTemplatesSection
                feedbackNode={templateFeedbackNode}
                highlighted={highlightedArea === "templates"}
                onApplyTemplate={handleApplyTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onSaveTemplate={handleSaveTemplate}
                onSelectedTemplateIdChange={setSelectedTemplateId}
                onTemplateNameChange={setTemplateName}
                sectionRef={templatesSectionRef}
                selectedTemplateId={selectedTemplateId}
                templateName={templateName}
                templateOptions={templateOptions}
              />

              {isGlobalMode && (
                <>
                  <SettingsToolsProfileSharingSection
                    copiedShareFormat={copiedShareFormat}
                    downloadError={shareDownloadError}
                    downloadProgress={shareDownloadProgress}
                    downloadSummary={shareDownloadSummary}
                    isDownloading={isShareDownloading}
                    onCopyShareList={handleCopyShareList}
                    onCopyUrls={handleCopyProfileShareUrls}
                    onDownloadAll={handleDownloadProfileShareCards}
                    orderedCardIds={orderedCardIds}
                    profileShareCards={profileShareCards}
                    profileShareSkippedDisabledCards={
                      profileShareSkippedDisabledCards
                    }
                    setDownloadError={setShareDownloadError}
                    setDownloadSummary={setShareDownloadSummary}
                    userId={userId}
                  />
                  <SettingsToolsWorkspaceBackupSection
                    feedbackNode={workspaceFeedbackNode}
                    highlighted={highlightedArea === "workspace"}
                    onCopyWorkspaceBackup={handleCopyWorkspaceBackup}
                    onDownloadWorkspaceBackup={handleDownloadWorkspaceBackup}
                    onWorkspaceImportFile={handleWorkspaceImportFile}
                    onWorkspaceImportOpenChange={setWorkspaceImportOpen}
                    onWorkspaceImportString={handleWorkspaceImportString}
                    onWorkspaceImportTextChange={setWorkspaceImportText}
                    sectionRef={workspaceSectionRef}
                    workspaceImportError={workspaceImportError}
                    workspaceImportOpen={workspaceImportOpen}
                    workspaceImportSuccess={workspaceImportSuccess}
                    workspaceImportText={workspaceImportText}
                  />
                </>
              )}

              {/* ── Import / Export ────────────────────────── */}
              <ToolGroup
                label="Import / Export (JSON)"
                highlighted={highlightedArea === "import"}
                sectionRef={importSectionRef}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={exportKind}
                      onValueChange={handleExportKindChange}
                    >
                      <SelectTrigger className="h-9 w-full border-border/60 sm:w-72">
                        <SelectValue placeholder="Export type" />
                      </SelectTrigger>
                      <SelectContent>
                        {exportKindOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 border-border/60 hover:bg-gold/5"
                      onClick={handleCopyJson}
                    >
                      <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
                      Copy JSON
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 border-border/60 hover:bg-gold/5"
                      onClick={handleDownloadJson}
                    >
                      <Download
                        className="mr-1.5 size-3.5"
                        aria-hidden="true"
                      />
                      Download
                    </Button>

                    <Dialog open={importOpen} onOpenChange={setImportOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 bg-gold text-white shadow-sm hover:bg-gold/90"
                        >
                          <FileUp
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Import
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="
                        max-h-[calc(var(--shell-viewport-min-height)-var(--safe-area-top)-var(--safe-area-bottom)-1rem)]
                        max-w-2xl overflow-y-auto
                      ">
                        <DialogHeader>
                          <DialogTitle>Import settings</DialogTitle>
                          <DialogDescription>
                            Paste JSON or choose a file. Supported: global,
                            card, templates, or combined exports.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor="settings-import-file"
                              className="sr-only"
                            >
                              Choose a JSON file to import
                            </Label>
                            <Input
                              id="settings-import-file"
                              type="file"
                              accept="application/json,.json"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                handleImportFile(f);
                                e.target.value = "";
                              }}
                            />
                          </div>

                          <SettingsToolsJsonExampleBlock
                            title="Accepted shapes + apply behavior"
                            example={SETTINGS_IMPORT_EXAMPLE}
                          >
                            <ul className="space-y-1 text-muted-foreground">
                              <li>
                                Bare snapshots like this one apply immediately
                                to the current target.
                              </li>
                              <li>
                                Wrapped exports with{" "}
                                <code>scope: "global"</code> or{" "}
                                <code>scope: "card"</code> also apply to the
                                current target.
                              </li>
                              <li>
                                <code>scope: "templates"</code> merges templates
                                into your saved library, while{" "}
                                <code>scope: "all"</code> applies global
                                settings and then merges templates.
                              </li>
                            </ul>
                          </SettingsToolsJsonExampleBlock>

                          <div className="space-y-2">
                            <Label
                              htmlFor="settings-import-text"
                              className="text-xs"
                            >
                              Or paste JSON
                            </Label>
                            <textarea
                              id="settings-import-text"
                              value={importText}
                              onChange={(e) => setImportText(e.target.value)}
                              spellCheck={false}
                              autoCorrect="off"
                              autoCapitalize="none"
                              autoComplete="off"
                              className="
                                h-48 w-full resize-none border border-border/60 bg-background p-3
                                font-mono text-xs text-foreground shadow-sm
                                focus:outline-none
                                focus-visible:ring-2 focus-visible:ring-gold/30
                              "
                              placeholder={`{\n  "schemaVersion": 1,\n  ...\n}`}
                            />
                          </div>

                          {importError ? (
                            <p role="alert" className="text-sm text-red-600">
                              {importError}
                            </p>
                          ) : null}
                          {importSuccess ? (
                            <output
                              className="text-sm text-green-600"
                              aria-live="polite"
                            >
                              {importSuccess}
                            </output>
                          ) : null}

                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setImportOpen(false);
                                setImportText("");
                                setImportError(null);
                                setImportSuccess(null);
                              }}
                            >
                              Close
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleImportString(importText)}
                              disabled={!importText.trim()}
                            >
                              Import
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="min-h-5 text-xs">{feedbackNode}</div>
                </div>
              </ToolGroup>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsToolsCopyFromCardSection(
  props: Readonly<{
    cardOptions: SettingsToolsCardOption[];
    copyFromCardId: string;
    highlighted?: boolean;
    onCopyFromCard: () => void;
    onCopyFromCardIdChange: (value: string) => void;
    sectionRef?: React.RefObject<HTMLDivElement | null>;
  }>,
) {
  return (
    <ToolGroup
      label="Copy from another card"
      highlighted={props.highlighted}
      sectionRef={props.sectionRef}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={props.copyFromCardId}
          onValueChange={props.onCopyFromCardIdChange}
        >
          <SelectTrigger className="h-9 w-full border-border/60 sm:w-72">
            <SelectValue placeholder="Select a card" />
          </SelectTrigger>
          <SelectContent>
            {props.cardOptions.map((cardOption) => (
              <SelectItem key={cardOption.id} value={cardOption.id}>
                {cardOption.label}
                {cardOption.enabled ? "" : " (disabled)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={props.onCopyFromCard}
          disabled={!props.copyFromCardId}
          className="h-9 border-border/60 hover:bg-gold/5"
        >
          <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
          Copy
        </Button>
      </div>
    </ToolGroup>
  );
}

function SettingsToolsTemplatesSection(
  props: Readonly<{
    feedbackNode: React.ReactNode;
    highlighted?: boolean;
    onApplyTemplate: () => void;
    onDeleteTemplate: () => void;
    onSaveTemplate: () => void;
    onSelectedTemplateIdChange: (value: string) => void;
    onTemplateNameChange: (value: string) => void;
    sectionRef?: React.RefObject<HTMLDivElement | null>;
    selectedTemplateId: string;
    templateName: string;
    templateOptions: SettingsTemplateV1[];
  }>,
) {
  return (
    <ToolGroup
      label="Templates"
      highlighted={props.highlighted}
      sectionRef={props.sectionRef}
    >
      <div className="space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={props.templateName}
            onChange={(event) => props.onTemplateNameChange(event.target.value)}
            placeholder="Template name"
            className="h-9 border-border/60 sm:w-72"
          />
          <Button
            type="button"
            size="sm"
            className="h-9 bg-gold text-white shadow-sm hover:bg-gold/90"
            onClick={props.onSaveTemplate}
            disabled={!props.templateName.trim()}
          >
            <FileDown className="mr-1.5 size-3.5" aria-hidden="true" />
            Save current
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={props.selectedTemplateId}
            onValueChange={props.onSelectedTemplateIdChange}
          >
            <SelectTrigger className="h-9 w-full border-border/60 sm:w-72">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {props.templateOptions.length === 0 ? (
                <SelectItem value="__no_templates" disabled>
                  No templates yet
                </SelectItem>
              ) : (
                props.templateOptions.map((templateOption) => (
                  <SelectItem key={templateOption.id} value={templateOption.id}>
                    {templateOption.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-border/60 hover:bg-gold/5"
            onClick={props.onApplyTemplate}
            disabled={!props.selectedTemplateId}
          >
            Apply
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9"
                disabled={!props.selectedTemplateId}
              >
                <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the template from your browser. This cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={props.onDeleteTemplate}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {props.feedbackNode}
      </div>
    </ToolGroup>
  );
}

function SettingsToolsProfileSharingSection(
  props: Readonly<{
    copiedShareFormat: SettingsToolsCopiedShareFormat;
    downloadError: string | null;
    downloadProgress: { current: number; total: number };
    downloadSummary: DownloadSummary | null;
    isDownloading: boolean;
    onCopyShareList: (list: string[]) => void | Promise<void>;
    onCopyUrls: (format?: ShareCardUrlFormat) => void | Promise<void>;
    onDownloadAll: (format?: CardDownloadFormat) => void | Promise<void>;
    orderedCardIds: string[];
    profileShareCards: SettingsToolsShareBuildResult["shareableCards"];
    profileShareSkippedDisabledCards: SettingsToolsShareBuildResult["skippedDisabledCards"];
    setDownloadError: SettingsToolsStringSetter;
    setDownloadSummary: SettingsToolsDownloadSummarySetter;
    userId: UserPageEditorStoreState["userId"];
  }>,
) {
  const shareActionsDisabled =
    !props.userId || props.orderedCardIds.length === 0;

  return (
    <ToolGroup label="Profile sharing">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {props.profileShareCards.length} enabled card
            {props.profileShareCards.length === 1 ? "" : "s"} ready to share.
          </span>
          {props.profileShareSkippedDisabledCards.length > 0 ? (
            <span>
              {props.profileShareSkippedDisabledCards.length} disabled card
              {props.profileShareSkippedDisabledCards.length === 1
                ? ""
                : "s"}{" "}
              excluded automatically.
            </span>
          ) : null}
          {props.userId ? null : (
            <span>Load a profile before generating share URLs.</span>
          )}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            shareActionsDisabled && "pointer-events-none opacity-50",
          )}
          aria-disabled={shareActionsDisabled}
        >
          <CopyUrlsPopover
            copiedFormat={props.copiedShareFormat}
            handleCopyUrls={props.onCopyUrls}
          />
          <DownloadPopover
            isDownloading={props.isDownloading}
            downloadProgress={props.downloadProgress}
            handleDownloadAll={props.onDownloadAll}
          />
        </div>

        <DownloadStatusAlerts
          downloadSummary={props.downloadSummary}
          downloadError={props.downloadError}
          setDownloadSummary={props.setDownloadSummary}
          setDownloadError={props.setDownloadError}
          copyToClipboard={props.onCopyShareList}
        />
      </div>
    </ToolGroup>
  );
}

function SettingsToolsWorkspaceBackupSection(
  props: Readonly<{
    feedbackNode: React.ReactNode;
    highlighted?: boolean;
    onCopyWorkspaceBackup: () => void | Promise<void>;
    onDownloadWorkspaceBackup: () => void;
    onWorkspaceImportFile: (file: File) => void | Promise<void>;
    onWorkspaceImportOpenChange: (value: boolean) => void;
    onWorkspaceImportString: (raw: string) => void;
    onWorkspaceImportTextChange: (value: string) => void;
    sectionRef?: React.RefObject<HTMLDivElement | null>;
    workspaceImportError: string | null;
    workspaceImportOpen: boolean;
    workspaceImportSuccess: string | null;
    workspaceImportText: string;
  }>,
) {
  return (
    <ToolGroup
      label="Workspace backup / restore"
      highlighted={props.highlighted}
      sectionRef={props.sectionRef}
    >
      <div className="space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-border/60 hover:bg-gold/5"
            onClick={props.onCopyWorkspaceBackup}
          >
            <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
            Copy backup JSON
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-border/60 hover:bg-gold/5"
            onClick={props.onDownloadWorkspaceBackup}
          >
            <Download className="mr-1.5 size-3.5" aria-hidden="true" />
            Download backup
          </Button>

          <Dialog
            open={props.workspaceImportOpen}
            onOpenChange={props.onWorkspaceImportOpenChange}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-9 bg-gold text-white shadow-sm hover:bg-gold/90"
              >
                <FileUp className="mr-1.5 size-3.5" aria-hidden="true" />
                Restore backup
              </Button>
            </DialogTrigger>
            <DialogContent className="
              max-h-[calc(var(--shell-viewport-min-height)-var(--safe-area-top)-var(--safe-area-bottom)-1rem)]
              max-w-2xl overflow-y-auto
            ">
              <DialogHeader>
                <DialogTitle>Restore workspace backup</DialogTitle>
                <DialogDescription>
                  Paste a full workspace backup or choose a file. This replaces
                  the current in-browser workspace view, template library, and
                  local recovery data.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="workspace-import-file" className="sr-only">
                    Choose a workspace backup file to import
                  </Label>
                  <Input
                    id="workspace-import-file"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      props.onWorkspaceImportFile(file);
                      event.target.value = "";
                    }}
                  />
                </div>

                <SettingsToolsJsonExampleBlock
                  title="Restore behavior + minimal valid backup"
                  example={WORKSPACE_RESTORE_EXAMPLE}
                >
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      Restore is destructive: it replaces the current in-browser
                      workspace view, card order, template library, and local
                      recovery state.
                    </li>
                    <li>
                      Use <strong>Copy backup JSON</strong> or{" "}
                      <strong>Download backup</strong> first if you want a
                      rollback point.
                    </li>
                  </ul>
                </SettingsToolsJsonExampleBlock>

                <div className="space-y-2">
                  <Label htmlFor="workspace-import-text" className="text-xs">
                    Or paste workspace backup JSON
                  </Label>
                  <textarea
                    id="workspace-import-text"
                    value={props.workspaceImportText}
                    onChange={(event) =>
                      props.onWorkspaceImportTextChange(event.target.value)
                    }
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    autoComplete="off"
                    className="
                      h-48 w-full resize-none border border-border/60 bg-background p-3 font-mono
                      text-xs text-foreground shadow-sm
                      focus:outline-none
                      focus-visible:ring-2 focus-visible:ring-gold/30
                    "
                    placeholder={`{
  "schemaVersion": 1,
  "scope": "workspace",
  ...
}`}
                  />
                </div>

                {props.workspaceImportError ? (
                  <p role="alert" className="text-sm text-red-600">
                    {props.workspaceImportError}
                  </p>
                ) : null}
                {props.workspaceImportSuccess ? (
                  <output className="text-sm text-green-600" aria-live="polite">
                    {props.workspaceImportSuccess}
                  </output>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      props.onWorkspaceImportOpenChange(false);
                      props.onWorkspaceImportTextChange("");
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      props.onWorkspaceImportString(props.workspaceImportText)
                    }
                    disabled={!props.workspaceImportText.trim()}
                  >
                    Restore
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="min-h-5 text-xs">{props.feedbackNode}</div>
      </div>
    </ToolGroup>
  );
}

/* ------------------------------------------------------------------ */
/*  Tool group with label                                             */
/* ------------------------------------------------------------------ */

function ToolGroup({
  label,
  highlighted = false,
  sectionRef,
  children,
}: Readonly<{
  label: string;
  highlighted?: boolean;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}>) {
  return (
    <div
      ref={sectionRef}
      className={cn(
        "space-y-2 rounded-sm border border-transparent p-2 transition-colors",
        highlighted && "border-gold/25 bg-gold/4 dark:border-gold/18",
      )}
    >
      <Label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
