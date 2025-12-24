"use client";

import type React from "react";
import {
  Loader2,
  Save,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { SettingsContent } from "@/components/user/SettingsContent";
import { cn } from "@/lib/utils";

type SettingsContentComponentProps = React.ComponentProps<
  typeof SettingsContent
>;

type SharedSettingsContentProps = Omit<
  SettingsContentComponentProps,
  "mode" | "idPrefix"
>;

interface BasePanelProps {
  title: string;
  description: string;
  settingsContentProps: SharedSettingsContentProps;
  className?: string;
}

interface GlobalPanelProps extends BasePanelProps {
  mode: "global";
  /** Optional handler for saving all changes. When omitted, no save button is shown. */
  onSaveAll?: () => void;
  /** When true, the Save All button is disabled (e.g., no changes). */
  saveAllDisabled?: boolean;
  /** When true, shows a spinner in the Save All button. */
  isSaving?: boolean;
}

interface CardPanelProps extends BasePanelProps {
  mode: "card";
  idPrefix: string;

  /** Whether this card is using custom settings. */
  useCustomSettings: boolean;
  /** Toggle handler for enabling/disabling custom settings. */
  onUseCustomSettingsChange: (enabled: boolean) => void;

  /** Optional helper message when custom settings are disabled. */
  customSettingsDisabledMessage?: string;
}

export type CardSettingsPanelProps = GlobalPanelProps | CardPanelProps;

/**
 * Shared settings panel used for both global and per-card settings.
 *
 * The panel renders identical layout in both contexts, with only two contextual extras:
 * - Global: an optional "Save All" button.
 * - Card: a "Use Custom Settings" toggle that gates showing the settings sections.
 */
export function CardSettingsPanel(props: Readonly<CardSettingsPanelProps>) {
  const { title, description, settingsContentProps, className } = props;

  const globalProps = props.mode === "global" ? props : null;
  const cardProps = props.mode === "card" ? props : null;

  let settingsBody: React.ReactNode;
  if (globalProps) {
    settingsBody = (
      <SettingsContent
        idPrefix="global"
        mode="global"
        {...settingsContentProps}
      />
    );
  } else if (cardProps?.useCustomSettings) {
    settingsBody = (
      <SettingsContent
        idPrefix={cardProps.idPrefix}
        mode="card"
        {...settingsContentProps}
      />
    );
  } else {
    settingsBody = (
      <div className="text-center text-sm text-muted-foreground">
        {cardProps?.customSettingsDisabledMessage ??
          "Enable custom settings above to customize this card's appearance."}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
            <SlidersHorizontal
              className="h-5 w-5 text-white"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </span>
            <p className="truncate text-sm font-normal text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {globalProps?.onSaveAll && (
          <Button
            onClick={globalProps.onSaveAll}
            disabled={
              Boolean(globalProps.saveAllDisabled) || globalProps.isSaving
            }
            size="sm"
            className={cn(
              "shrink-0 rounded-lg transition-all",
              globalProps.saveAllDisabled
                ? "bg-slate-100 text-slate-400 dark:bg-slate-700"
                : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg",
            )}
          >
            {globalProps.isSaving ? (
              <Loader2
                className="mr-1.5 h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            Save All
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-6">
        {cardProps && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm dark:border-slate-700/50 dark:from-slate-800/50 dark:to-slate-900">
            <div className="flex items-center gap-3">
              {cardProps.useCustomSettings ? (
                <ToggleRight
                  className="h-5 w-5 text-blue-500"
                  aria-hidden="true"
                />
              ) : (
                <ToggleLeft
                  className="h-5 w-5 text-slate-400"
                  aria-hidden="true"
                />
              )}
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Use Custom Settings
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {cardProps.useCustomSettings
                    ? "This card uses custom colors and borders"
                    : "This card uses global settings"}
                </p>
              </div>
            </div>
            <Switch
              checked={cardProps.useCustomSettings}
              onCheckedChange={cardProps.onUseCustomSettingsChange}
              className="data-[state=checked]:bg-blue-500"
              aria-label="Use Custom Settings"
            />
          </div>
        )}

        {settingsBody}
      </div>
    </div>
  );
}
