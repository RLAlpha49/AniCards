"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Copy, Download, FileDown, FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
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
import { useShallow } from "zustand/react/shallow";
import { statCardTypes } from "@/components/stat-card-generator/constants";
import {
  makeSettingsExport,
  parseSettingsExportJson,
  stringifySettingsExport,
  type SettingsExportV1,
  type SettingsSnapshot,
} from "@/lib/user-page-settings-io";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";

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

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Some browsers may cancel the download if the object URL is revoked too early.
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

  const {
    cardConfigs,
    settingsTemplates,
    getGlobalSettingsSnapshot,
    getCardSettingsSnapshot,
    applySettingsSnapshotToGlobal,
    applySettingsSnapshotToCard,
    copySettingsFromCard,
    createSettingsTemplate,
    deleteSettingsTemplate,
    applySettingsTemplateToGlobal,
    applySettingsTemplateToCard,
    importSettingsTemplates,
    exportSettingsTemplates,
  } = useUserPageEditor(
    useShallow((s) => ({
      cardConfigs: s.cardConfigs,
      settingsTemplates: s.settingsTemplates,
      getGlobalSettingsSnapshot: s.getGlobalSettingsSnapshot,
      getCardSettingsSnapshot: s.getCardSettingsSnapshot,
      applySettingsSnapshotToGlobal: s.applySettingsSnapshotToGlobal,
      applySettingsSnapshotToCard: s.applySettingsSnapshotToCard,
      copySettingsFromCard: s.copySettingsFromCard,
      createSettingsTemplate: s.createSettingsTemplate,
      deleteSettingsTemplate: s.deleteSettingsTemplate,
      applySettingsTemplateToGlobal: s.applySettingsTemplateToGlobal,
      applySettingsTemplateToCard: s.applySettingsTemplateToCard,
      importSettingsTemplates: s.importSettingsTemplates,
      exportSettingsTemplates: s.exportSettingsTemplates,
    })),
  );

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
  }, [cardConfigs, props.mode, props.mode === "card" ? props.cardId : null]);

  const feedbackNode = useMemo(() => {
    if (importError) {
      return <span className="text-red-600">{importError}</span>;
    }
    if (importSuccess) {
      return <span className="text-green-600">{importSuccess}</span>;
    }

    return (
      <span className="text-slate-500 dark:text-slate-400">
        Exported JSON is safe to share (no secrets), but it may reveal your
        styling preferences.
      </span>
    );
  }, [importError, importSuccess]);

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
        importSettingsTemplates(exp.templates);
        setImportSuccess(`Imported ${exp.templates.length} template(s).`);
        return;
      }

      if (exp.scope === "all") {
        importSettingsTemplates(exp.templates);
        applySnapshotToTarget(exp.global);
        setImportSuccess("Imported global settings + templates.");
        return;
      }

      if (exp.scope === "global") {
        applySnapshotToTarget(exp.global);
        setImportSuccess("Imported settings applied.");
        return;
      }

      // exp.scope === "card"
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

  const handleSaveTemplate = useCallback(() => {
    const trimmed = templateName.trim();
    if (!trimmed) return;

    const snapshot =
      props.mode === "global"
        ? getGlobalSettingsSnapshot()
        : getCardSettingsSnapshot(props.cardId);

    createSettingsTemplate(trimmed, snapshot);
    setTemplateName("");
  }, [
    createSettingsTemplate,
    getCardSettingsSnapshot,
    getGlobalSettingsSnapshot,
    props,
    templateName,
  ]);

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
    <div className="space-y-4 rounded-xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Settings tools
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Copy, save, apply, and import/export settings
          </div>
        </div>
      </div>

      {props.mode === "card" && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Copy settings from another card
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={copyFromCardId} onValueChange={setCopyFromCardId}>
              <SelectTrigger className="h-9 w-full sm:w-80">
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
              className="h-9"
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copy
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Templates
        </Label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name"
            className="h-9 sm:w-80"
          />
          <Button
            type="button"
            size="sm"
            className="h-9"
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
          >
            <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
            Save current
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
          >
            <SelectTrigger className="h-9 w-full sm:w-80">
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
            className="h-9"
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
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
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
                <AlertDialogAction
                  onClick={() => {
                    if (!selectedTemplateId) return;
                    deleteSettingsTemplate(selectedTemplateId);
                    setSelectedTemplateId("");
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Import / Export (JSON)
        </Label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={exportKind} onValueChange={handleExportKindChange}>
            <SelectTrigger className="h-9 w-full sm:w-80">
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
            className="h-9"
            onClick={handleCopyJson}
          >
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Copy JSON
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={handleDownloadJson}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Download
          </Button>

          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" className="h-9">
                <FileUp className="mr-2 h-4 w-4" aria-hidden="true" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import settings</DialogTitle>
                <DialogDescription>
                  Paste JSON or choose a file. Supported: global, card,
                  templates, or combined exports.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="settings-import-file" className="sr-only">
                    Choose a JSON file to import
                  </Label>
                  <Input
                    id="settings-import-file"
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void handleImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-import-text" className="text-xs">
                    Or paste JSON
                  </Label>
                  <textarea
                    id="settings-import-text"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="h-48 w-full resize-none rounded-md border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    placeholder={`{\n  "schemaVersion": 1,\n  ...\n}`}
                  />
                </div>

                {importError ? (
                  <p role="alert" className="text-sm text-red-600">
                    {importError}
                  </p>
                ) : null}
                {importSuccess ? (
                  <output className="text-sm text-green-600" aria-live="polite">
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

        {/* Inline feedback for copy */}
        <div className="min-h-[1.25rem] text-xs">{feedbackNode}</div>
      </div>
    </div>
  );
}
