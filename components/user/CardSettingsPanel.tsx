"use client";

import {
  Loader2,
  Save,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

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
  /** Optional tools UI rendered above the settings content. */
  tools?: React.ReactNode;
  className?: string;
}

interface GlobalPanelProps extends BasePanelProps {
  mode: "global";
  /** Optional handler for saving all changes. When omitted, no save button is shown. */
  onSaveAll?: () => void | Promise<void>;
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
  /** Whether this card has any overrides (colors, borders, advanced) */
  isCustomized?: boolean;
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
function SettingsBody({
  globalProps,
  cardProps,
  settingsContentProps,
  onValidityChange,
}: Readonly<{
  globalProps: GlobalPanelProps | null;
  cardProps: CardPanelProps | null;
  settingsContentProps: SharedSettingsContentProps;
  onValidityChange: (valid: boolean) => void;
}>) {
  if (globalProps) {
    return (
      <SettingsContent
        idPrefix="global"
        mode="global"
        {...settingsContentProps}
        onValidityChange={onValidityChange}
      />
    );
  }

  if (cardProps?.useCustomSettings) {
    return (
      <SettingsContent
        idPrefix={cardProps.idPrefix}
        mode="card"
        {...settingsContentProps}
        onValidityChange={onValidityChange}
      />
    );
  }

  return (
    <div className="text-center text-sm text-muted-foreground">
      {cardProps?.customSettingsDisabledMessage ??
        "Enable custom settings above to customize this card's appearance."}
    </div>
  );
}

export function CardSettingsPanel(props: Readonly<CardSettingsPanelProps>) {
  const { title, description, settingsContentProps, className, tools } = props;

  const globalProps = props.mode === "global" ? props : null;
  const cardProps = props.mode === "card" ? props : null;
  const [isSettingsValid, setIsSettingsValid] = useState(true);

  const isCustomized = cardProps
    ? Boolean(cardProps.isCustomized ?? cardProps.useCustomSettings)
    : false;

  const iconClass = isCustomized
    ? "bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-cyan-500/20"
    : "bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25";

  const useCustomPanelClass = isCustomized
    ? "border-blue-200 bg-gradient-to-r from-blue-50 to-white dark:border-blue-900/40 dark:from-blue-900/10"
    : "border-slate-200/50 bg-gradient-to-r from-slate-50 to-white dark:border-slate-700/50 dark:from-slate-800/50 dark:to-slate-900";

  const useCustomTitleClass = isCustomized
    ? "text-blue-700 dark:text-blue-200"
    : "text-slate-900 dark:text-white";

  const useCustomPClass = isCustomized
    ? "text-blue-600"
    : "text-slate-500 dark:text-slate-400";

  // Move settings body rendering to a small helper to keep main function complexity low
  const settingsBody = (
    <SettingsBody
      globalProps={globalProps}
      cardProps={cardProps}
      settingsContentProps={settingsContentProps}
      onValidityChange={setIsSettingsValid}
    />
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              iconClass,
            )}
          >
            <SlidersHorizontal
              className="h-5 w-5 text-white"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="block truncate text-lg font-semibold text-slate-900 dark:text-white">
                {title}
              </span>
              {isCustomized ? (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  Custom <span className="sr-only">settings applied</span>
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm font-normal text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {globalProps?.onSaveAll && (
          <Button
            onClick={globalProps.onSaveAll}
            disabled={
              Boolean(globalProps.saveAllDisabled) ||
              globalProps.isSaving ||
              !isSettingsValid
            }
            size="sm"
            className={cn(
              "shrink-0 rounded-lg transition-all",
              globalProps.saveAllDisabled || !isSettingsValid
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
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border p-4 shadow-sm",
              useCustomPanelClass,
            )}
          >
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
                <span
                  className={cn("text-sm font-semibold", useCustomTitleClass)}
                >
                  Use Custom Settings
                </span>
                <p className={cn("text-xs", useCustomPClass)}>
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

        {tools ? <div>{tools}</div> : null}

        {settingsBody}
      </div>
    </div>
  );
}
