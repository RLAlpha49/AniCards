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
} from "./share-utils";

type SettingsToolsProps =
  | {
      mode: "card";
      cardId: string;
      cardLabel: string;
    }
  | {
      mode: "global";
    };

type ExportKind = "current" | "templates" | "all";

type InlineFeedback = {
  message: string;
  tone: "error" | "success";
};

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

function isExportKind(value: string): value is ExportKind {
  return value === "current" || value === "templates" || value === "all";
}

export function SettingsTools(props: Readonly<SettingsToolsProps>) {
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [copyFromCardId, setCopyFromCardId] = useState<string>("");

  const [exportKind, setExportKind] = useState<ExportKind>(
    props.mode === "global" ? "all" : "current",
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
  const [copiedShareFormat, setCopiedShareFormat] = useState<
    "url" | "anilist" | "failed-list" | null
  >(null);
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

  const [isExpanded, setIsExpanded] = useState(props.mode === "global");
  const shareCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareDownloadSummaryTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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
      if (shareCopyTimerRef.current) {
        clearTimeout(shareCopyTimerRef.current);
        shareCopyTimerRef.current = null;
      }
      if (shareDownloadSummaryTimerRef.current) {
        clearTimeout(shareDownloadSummaryTimerRef.current);
        shareDownloadSummaryTimerRef.current = null;
      }
    };
  }, []);

  const templateOptions = useMemo(() => {
    return [...settingsTemplates].sort((a, b) => a.name.localeCompare(b.name));
  }, [settingsTemplates]);

  const cardOptions = useMemo(() => {
    if (props.mode !== "card") return [];

    const metaById = new Map(statCardTypes.map((t) => [t.id, t] as const));

    return Object.values(cardConfigs)
      .filter((c) => c.cardId !== props.cardId)
      .map((c) => {
        const meta = metaById.get(c.cardId);
        return {
          id: c.cardId,
          label: meta?.label ?? c.cardId,
          enabled: c.enabled,
        };
      })
      .sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
  }, [cardConfigs, props]);

  const feedbackNode = useMemo(() => {
    if (importError) {
      return <span className="text-red-600">{importError}</span>;
    }
    if (importSuccess) {
      return <span className="text-green-600">{importSuccess}</span>;
    }

    return (
      <span className="text-muted-foreground">
        Exported JSON is safe to share (no secrets), but it may reveal your
        styling preferences.
      </span>
    );
  }, [importError, importSuccess]);

  const workspaceFeedbackNode = useMemo(() => {
    if (workspaceImportError) {
      return <span className="text-red-600">{workspaceImportError}</span>;
    }
    if (workspaceImportSuccess) {
      return <span className="text-green-600">{workspaceImportSuccess}</span>;
    }

    return (
      <span className="text-muted-foreground">
        Full workspace backups stay local to your browser and include global
        settings, per-card configs, ordering, templates, and local recovery
        state.
      </span>
    );
  }, [workspaceImportError, workspaceImportSuccess]);

  const orderedCardIds = useMemo(() => {
    const seen = new Set<string>();
    const orderedIds: string[] = [];

    for (const cardId of cardOrder) {
      if (!cardConfigs[cardId] || seen.has(cardId)) continue;
      seen.add(cardId);
      orderedIds.push(cardId);
    }

    for (const cardId of Object.keys(cardConfigs).sort((a, b) =>
      a.localeCompare(b),
    )) {
      if (seen.has(cardId)) continue;
      seen.add(cardId);
      orderedIds.push(cardId);
    }

    return orderedIds;
  }, [cardConfigs, cardOrder]);

  const {
    shareableCards: profileShareCards,
    skippedDisabledCards: profileShareSkippedDisabledCards,
  } = useMemo(() => {
    if (props.mode !== "global") {
      return {
        shareableCards: [],
        skippedDisabledCards: [] as Array<{ cardId: string; rawType: string }>,
      };
    }

    return buildShareableCards({
      cardConfigs,
      cardIds: orderedCardIds,
      getEffectiveBorderColor,
      getEffectiveBorderRadius,
      getEffectiveColors,
      globalAdvancedSettings,
      globalColorPreset,
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
    if (props.mode !== "global") return null;

    const draftRecord = userId ? readUserPageDraft(userId) : null;
    const exitSaveFallbackRecord = userId
      ? readUserPageExitSaveFallback(userId)
      : null;

    return makeWorkspaceBackup({
      userId,
      username,
      workspace: {
        global: getGlobalSettingsSnapshot(),
        cardConfigs,
        cardOrder: orderedCardIds,
      },
      editorState: {
        templates: settingsTemplates,
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
    if (props.mode === "global") {
      const global = getGlobalSettingsSnapshot();
      return makeSettingsExport({ schemaVersion: 1, scope: "global", global });
    }

    const card = getCardSettingsSnapshot(props.cardId);
    return makeSettingsExport({
      schemaVersion: 1,
      scope: "card",
      cardId: props.cardId,
      cardLabel: props.cardLabel,
      card,
    });
  }, [getCardSettingsSnapshot, getGlobalSettingsSnapshot, props]);

  const buildExport = useCallback((): SettingsExportV1 => {
    if (exportKind === "templates") {
      return exportSettingsTemplates();
    }

    if (exportKind === "all") {
      const global = getGlobalSettingsSnapshot();
      return makeSettingsExport({
        schemaVersion: 1,
        scope: "all",
        global,
        templates: settingsTemplates,
      });
    }

    return buildCurrentExport();
  }, [
    buildCurrentExport,
    exportKind,
    exportSettingsTemplates,
    getGlobalSettingsSnapshot,
    settingsTemplates,
  ]);

  const handleCopyJson = useCallback(async () => {
    const exp = buildExport();
    const json = stringifySettingsExport(exp);

    try {
      await navigator.clipboard.writeText(json);
      setImportSuccess("Export copied to clipboard.");
      setTimeout(() => setImportSuccess(null), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Failed to copy: ${msg}`);
      setTimeout(() => setImportError(null), 2500);
    }
  }, [buildExport]);

  const handleDownloadJson = useCallback(() => {
    const exp = buildExport();
    const json = stringifySettingsExport(exp);
    downloadJson(buildExportFilename(exp), json);
  }, [buildExport]);

  const handleCopyProfileShareUrls = useCallback(
    async (format: "url" | "anilist" = "url") => {
      if (profileShareCards.length === 0) return;

      try {
        await copyShareableCardUrlsToClipboard(profileShareCards, format);
        setCopiedShareFormat(format);
        if (shareCopyTimerRef.current) {
          clearTimeout(shareCopyTimerRef.current);
          shareCopyTimerRef.current = null;
        }
        shareCopyTimerRef.current = globalThis.setTimeout(() => {
          setCopiedShareFormat(null);
          shareCopyTimerRef.current = null;
        }, 2000);
      } catch (error) {
        console.error("Failed to copy profile share URLs:", error);
      }
    },
    [profileShareCards],
  );

  const handleCopyShareList = useCallback(async (list: string[]) => {
    if (list.length === 0) return;

    try {
      await navigator.clipboard.writeText(list.join("\n"));
      setCopiedShareFormat("failed-list");
      if (shareCopyTimerRef.current) {
        clearTimeout(shareCopyTimerRef.current);
        shareCopyTimerRef.current = null;
      }
      shareCopyTimerRef.current = globalThis.setTimeout(() => {
        setCopiedShareFormat(null);
        shareCopyTimerRef.current = null;
      }, 2000);
    } catch (error) {
      console.error("Failed to copy share list:", error);
    }
  }, []);

  const handleDownloadProfileShareCards = useCallback(
    async (format: CardDownloadFormat = "png") => {
      if (isShareDownloading) return;

      const skippedDisabledRawTypes = profileShareSkippedDisabledCards.map(
        (card) => card.rawType,
      );

      if (
        profileShareCards.length === 0 &&
        skippedDisabledRawTypes.length === 0
      ) {
        return;
      }

      if (shareDownloadSummaryTimerRef.current) {
        clearTimeout(shareDownloadSummaryTimerRef.current);
        shareDownloadSummaryTimerRef.current = null;
      }
      setShareDownloadSummary(null);
      setShareDownloadError(null);

      if (profileShareCards.length === 0) {
        setShareDownloadSummary(
          createDownloadSummary({
            requestedTotal: orderedCardIds.length,
            skippedDisabledCardRawTypes: skippedDisabledRawTypes,
          }),
        );
        return;
      }

      setIsShareDownloading(true);
      setShareDownloadProgress({ current: 0, total: profileShareCards.length });

      try {
        const result = await downloadShareableCards({
          cards: profileShareCards,
          format,
          onProgress: (progress) => {
            setShareDownloadProgress({
              current: progress.current,
              total: progress.total,
            });
          },
        });

        const failedRawTypes =
          result.failedCards?.map((card) => card.rawType || card.type) ?? [];
        const nextSummary = createDownloadSummary({
          requestedTotal: orderedCardIds.length,
          exported: result.exported,
          failed: result.failed,
          failedCardRawTypes: failedRawTypes,
          skippedDisabledCardRawTypes: skippedDisabledRawTypes,
        });

        setShareDownloadSummary(nextSummary);
        shareDownloadSummaryTimerRef.current = globalThis.setTimeout(
          () => {
            setShareDownloadSummary(null);
            shareDownloadSummaryTimerRef.current = null;
          },
          nextSummary.failed > 0 ? 10000 : 5000,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setShareDownloadError(message);
      } finally {
        setIsShareDownloading(false);
      }
    },
    [
      isShareDownloading,
      orderedCardIds.length,
      profileShareCards,
      profileShareSkippedDisabledCards,
    ],
  );

  const handleCopyWorkspaceBackup = useCallback(async () => {
    const backup = buildWorkspaceBackupPayload();
    if (!backup) return;

    const json = stringifyWorkspaceBackup(backup);
    try {
      await navigator.clipboard.writeText(json);
      setWorkspaceImportSuccess("Workspace backup copied to clipboard.");
      globalThis.setTimeout(() => setWorkspaceImportSuccess(null), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceImportError(`Failed to copy workspace backup: ${message}`);
      globalThis.setTimeout(() => setWorkspaceImportError(null), 2500);
    }
  }, [buildWorkspaceBackupPayload]);

  const handleDownloadWorkspaceBackup = useCallback(() => {
    const backup = buildWorkspaceBackupPayload();
    if (!backup) return;

    downloadJson(
      buildWorkspaceBackupFilename({
        exportedAt: backup.exportedAt,
        userId: backup.userId,
        username: backup.username,
      }),
      stringifyWorkspaceBackup(backup),
    );
    setWorkspaceImportSuccess("Workspace backup downloaded.");
    globalThis.setTimeout(() => setWorkspaceImportSuccess(null), 1500);
  }, [buildWorkspaceBackupPayload]);

  const applySnapshotToTarget = useCallback(
    (snapshot: SettingsSnapshot) => {
      if (props.mode === "global") {
        applySettingsSnapshotToGlobal(snapshot);
      } else {
        applySettingsSnapshotToCard(props.cardId, snapshot);
      }
    },
    [applySettingsSnapshotToCard, applySettingsSnapshotToGlobal, props],
  );

  const handleImportString = useCallback(
    (raw: string) => {
      setImportError(null);
      setImportSuccess(null);
      setTemplateFeedback(null);

      const parsed = parseSettingsExportJson(raw);
      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }

      if (parsed.value.kind === "snapshot") {
        applySnapshotToTarget(parsed.value.snapshot);
        setImportSuccess("Imported settings applied.");
        return;
      }

      const exp = parsed.value.value;
      if (exp.scope === "templates") {
        const importResult = importSettingsTemplates(exp.templates);
        if (!importResult.ok) {
          setImportError(importResult.error);
          return;
        }
        setImportSuccess(`Imported ${exp.templates.length} template(s).`);
        return;
      }

      if (exp.scope === "all") {
        applySnapshotToTarget(exp.global);

        const importResult = importSettingsTemplates(exp.templates);
        if (!importResult.ok) {
          setImportError(
            `Imported settings applied, but ${importResult.error}`,
          );
          return;
        }

        setImportSuccess("Imported global settings + templates.");
        return;
      }

      if (exp.scope === "global") {
        applySnapshotToTarget(exp.global);
        setImportSuccess("Imported settings applied.");
        return;
      }

      applySnapshotToTarget(exp.card);
      setImportSuccess("Imported settings applied.");
    },
    [applySnapshotToTarget, importSettingsTemplates],
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      setImportError(null);
      setImportSuccess(null);

      try {
        const text = await file.text();
        handleImportString(text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setImportError(`Failed to read file: ${msg}`);
      }
    },
    [handleImportString],
  );

  const handleWorkspaceImportString = useCallback(
    (raw: string) => {
      setWorkspaceImportError(null);
      setWorkspaceImportSuccess(null);

      const parsed = parseWorkspaceBackupJson(raw);
      if (!parsed.ok) {
        setWorkspaceImportError(parsed.error);
        return;
      }

      const backup = parsed.value;
      applySettingsSnapshotToGlobal(backup.workspace.global);
      applyLocalEditsPatch({
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

      if (userId) {
        if (backup.editorState.draft) {
          writeUserPageDraft(userId, backup.editorState.draft.patch);
        } else {
          clearUserPageDraft(userId);
        }

        if (backup.editorState.exitSaveFallback) {
          writeUserPageExitSaveFallback(
            userId,
            backup.editorState.exitSaveFallback.reason,
          );
        } else {
          clearUserPageExitSaveFallback(userId);
        }
      }

      const backupIdentity = backup.username ?? backup.userId;
      if (!persistTemplatesResult.ok) {
        setWorkspaceImportError(
          `Workspace restored${backupIdentity ? ` from ${backupIdentity}` : ""}, but ${persistTemplatesResult.error}`,
        );
        return;
      }

      setWorkspaceImportSuccess(
        `Workspace restored${backupIdentity ? ` from ${backupIdentity}` : ""}.`,
      );
    },
    [applyLocalEditsPatch, applySettingsSnapshotToGlobal, userId],
  );

  const handleWorkspaceImportFile = useCallback(
    async (file: File) => {
      setWorkspaceImportError(null);
      setWorkspaceImportSuccess(null);

      try {
        const text = await file.text();
        handleWorkspaceImportString(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkspaceImportError(`Failed to read file: ${message}`);
      }
    },
    [handleWorkspaceImportString],
  );

  const handleSaveTemplate = useCallback(() => {
    const trimmed = templateName.trim();
    if (!trimmed) return;

    setImportError(null);
    setImportSuccess(null);
    setTemplateFeedback(null);

    const snapshot =
      props.mode === "global"
        ? getGlobalSettingsSnapshot()
        : getCardSettingsSnapshot(props.cardId);

    const createResult = createSettingsTemplate(trimmed, snapshot);
    if (!createResult.ok) {
      setTemplateFeedback({
        message: createResult.error,
        tone: "error",
      });
      return;
    }

    setTemplateName("");
    setTemplateFeedback({
      message: `Saved template "${trimmed.slice(0, 80)}".`,
      tone: "success",
    });
  }, [
    createSettingsTemplate,
    getCardSettingsSnapshot,
    getGlobalSettingsSnapshot,
    props,
    templateName,
  ]);

  const handleDeleteTemplate = useCallback(() => {
    if (!selectedTemplateId) return;

    setImportError(null);
    setImportSuccess(null);
    setTemplateFeedback(null);

    const selectedTemplateName =
      templateOptions.find((template) => template.id === selectedTemplateId)
        ?.name ?? "template";
    const deleteResult = deleteSettingsTemplate(selectedTemplateId);

    if (!deleteResult.ok) {
      setTemplateFeedback({
        message: deleteResult.error,
        tone: "error",
      });
      return;
    }

    setSelectedTemplateId("");
    setTemplateFeedback({
      message: `Deleted template "${selectedTemplateName}".`,
      tone: "success",
    });
  }, [deleteSettingsTemplate, selectedTemplateId, templateOptions]);

  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplateId) return;

    if (props.mode === "global") {
      applySettingsTemplateToGlobal(selectedTemplateId);
    } else {
      applySettingsTemplateToCard(props.cardId, selectedTemplateId);
    }
  }, [
    applySettingsTemplateToCard,
    applySettingsTemplateToGlobal,
    props,
    selectedTemplateId,
  ]);

  const handleCopyFromCard = useCallback(() => {
    if (props.mode !== "card") return;
    if (!copyFromCardId) return;
    copySettingsFromCard(copyFromCardId, props.cardId);
  }, [copyFromCardId, copySettingsFromCard, props]);

  const exportKindOptions = useMemo(() => {
    const base: Array<{ value: ExportKind; label: string }> = [
      {
        value: "current",
        label:
          props.mode === "global" ? "Global settings" : "This card settings",
      },
      { value: "templates", label: "Templates" },
    ];

    if (props.mode === "global") {
      base.push({ value: "all", label: "Global + templates" });
    }

    return base;
  }, [props.mode]);

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
              {/* ── Copy from Card ─────────────────────────── */}
              {props.mode === "card" && (
                <ToolGroup label="Copy from another card">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={copyFromCardId}
                      onValueChange={setCopyFromCardId}
                    >
                      <SelectTrigger className="h-9 w-full border-border/60 sm:w-72">
                        <SelectValue placeholder="Select a card" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                            {c.enabled ? "" : " (disabled)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyFromCard}
                      disabled={!copyFromCardId}
                      className="h-9 border-border/60 hover:bg-gold/5"
                    >
                      <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
                      Copy
                    </Button>
                  </div>
                </ToolGroup>
              )}

              {/* ── Templates ─────────────────────────────── */}
              <ToolGroup label="Templates">
                <div className="space-y-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name"
                      className="h-9 border-border/60 sm:w-72"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 bg-gold text-white shadow-sm hover:bg-gold/90"
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim()}
                    >
                      <FileDown
                        className="mr-1.5 size-3.5"
                        aria-hidden="true"
                      />
                      Save current
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger className="h-9 w-full border-border/60 sm:w-72">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templateOptions.length === 0 ? (
                          <SelectItem value="__no_templates" disabled>
                            No templates yet
                          </SelectItem>
                        ) : (
                          templateOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
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
                      onClick={handleApplyTemplate}
                      disabled={!selectedTemplateId}
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
                          disabled={!selectedTemplateId}
                        >
                          <Trash2
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the template from your browser.
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteTemplate}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {templateFeedback ? (
                    templateFeedback.tone === "error" ? (
                      <p role="alert" className="text-sm text-red-600">
                        {templateFeedback.message}
                      </p>
                    ) : (
                      <output
                        className="text-sm text-green-600"
                        aria-live="polite"
                      >
                        {templateFeedback.message}
                      </output>
                    )
                  ) : null}
                </div>
              </ToolGroup>

              {props.mode === "global" ? (
                <>
                  <ToolGroup label="Profile sharing">
                    <div className="space-y-3">
                      <div className="
                        flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground
                      ">
                        <span>
                          {profileShareCards.length} enabled card
                          {profileShareCards.length === 1 ? "" : "s"} ready to
                          share.
                        </span>
                        {profileShareSkippedDisabledCards.length > 0 ? (
                          <span>
                            {profileShareSkippedDisabledCards.length} disabled
                            card
                            {profileShareSkippedDisabledCards.length === 1
                              ? ""
                              : "s"}{" "}
                            excluded automatically.
                          </span>
                        ) : null}
                        {!userId ? (
                          <span>
                            Load a profile before generating share URLs.
                          </span>
                        ) : null}
                      </div>

                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2",
                          (!userId || orderedCardIds.length === 0) &&
                            "pointer-events-none opacity-50",
                        )}
                        aria-disabled={!userId || orderedCardIds.length === 0}
                      >
                        <CopyUrlsPopover
                          copiedFormat={copiedShareFormat}
                          handleCopyUrls={handleCopyProfileShareUrls}
                        />
                        <DownloadPopover
                          isDownloading={isShareDownloading}
                          downloadProgress={shareDownloadProgress}
                          handleDownloadAll={handleDownloadProfileShareCards}
                        />
                      </div>

                      <DownloadStatusAlerts
                        downloadSummary={shareDownloadSummary}
                        downloadError={shareDownloadError}
                        setDownloadSummary={setShareDownloadSummary}
                        setDownloadError={setShareDownloadError}
                        copyToClipboard={handleCopyShareList}
                      />
                    </div>
                  </ToolGroup>

                  <ToolGroup label="Workspace backup / restore">
                    <div className="space-y-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 border-border/60 hover:bg-gold/5"
                          onClick={handleCopyWorkspaceBackup}
                        >
                          <Copy
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Copy backup JSON
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 border-border/60 hover:bg-gold/5"
                          onClick={handleDownloadWorkspaceBackup}
                        >
                          <Download
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Download backup
                        </Button>

                        <Dialog
                          open={workspaceImportOpen}
                          onOpenChange={setWorkspaceImportOpen}
                        >
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
                              Restore backup
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>
                                Restore workspace backup
                              </DialogTitle>
                              <DialogDescription>
                                Paste a full workspace backup or choose a file.
                                This replaces the current in-browser workspace
                                view, template library, and local recovery data.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Label
                                  htmlFor="workspace-import-file"
                                  className="sr-only"
                                >
                                  Choose a workspace backup file to import
                                </Label>
                                <Input
                                  id="workspace-import-file"
                                  type="file"
                                  accept="application/json,.json"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    handleWorkspaceImportFile(file);
                                    e.target.value = "";
                                  }}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label
                                  htmlFor="workspace-import-text"
                                  className="text-xs"
                                >
                                  Or paste workspace backup JSON
                                </Label>
                                <textarea
                                  id="workspace-import-text"
                                  value={workspaceImportText}
                                  onChange={(e) =>
                                    setWorkspaceImportText(e.target.value)
                                  }
                                  className="
                                    h-48 w-full resize-none border border-border/60 bg-background
                                    p-3 font-mono text-xs text-foreground shadow-sm
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

                              {workspaceImportError ? (
                                <p
                                  role="alert"
                                  className="text-sm text-red-600"
                                >
                                  {workspaceImportError}
                                </p>
                              ) : null}
                              {workspaceImportSuccess ? (
                                <output
                                  className="text-sm text-green-600"
                                  aria-live="polite"
                                >
                                  {workspaceImportSuccess}
                                </output>
                              ) : null}

                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setWorkspaceImportOpen(false);
                                    setWorkspaceImportText("");
                                    setWorkspaceImportError(null);
                                    setWorkspaceImportSuccess(null);
                                  }}
                                >
                                  Close
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() =>
                                    handleWorkspaceImportString(
                                      workspaceImportText,
                                    )
                                  }
                                  disabled={!workspaceImportText.trim()}
                                >
                                  Restore
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="min-h-5 text-xs">
                        {workspaceFeedbackNode}
                      </div>
                    </div>
                  </ToolGroup>
                </>
              ) : null}

              {/* ── Import / Export ────────────────────────── */}
              <ToolGroup label="Import / Export (JSON)">
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
                      <DialogContent className="max-w-2xl">
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

/* ------------------------------------------------------------------ */
/*  Tool group with label                                             */
/* ------------------------------------------------------------------ */

function ToolGroup({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
