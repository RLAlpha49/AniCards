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
    <div className="text-muted-foreground text-center text-sm">
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
    ? "bg-linear-to-br from-gold via-amber-500 to-gold-dim shadow-md shadow-gold/20 ring-2 ring-gold/25"
    : "bg-linear-to-br from-gold/40 to-amber-400/40 shadow-lg shadow-gold/15 ring-1 ring-gold/10";

  const useCustomPanelClass = isCustomized
    ? "border-2 border-gold/25 bg-linear-to-r from-gold/10 to-background dark:border-gold/20 dark:from-gold/5"
    : "border-2 border-gold/15 bg-linear-to-r from-gold/3 to-background dark:border-gold/10 dark:from-gold/3";

  const useCustomTitleClass = isCustomized
    ? "text-gold-dim dark:text-gold"
    : "text-foreground";

  const useCustomPClass = isCustomized
    ? "text-gold-dim"
    : "text-muted-foreground";

  const settingsBody = (
    <SettingsBody
      globalProps={globalProps}
      cardProps={cardProps}
      settingsContentProps={settingsContentProps}
      onValidityChange={setIsSettingsValid}
    />
  );

  return (
    <div className={cn("space-y-5", className)}>
      <div className="border-gold/15 from-gold/5 via-background to-background dark:border-gold/10 dark:from-gold/3 flex items-center justify-between gap-4 rounded-xl border bg-linear-to-r p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
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
              <span className="text-foreground font-display block truncate text-lg font-semibold">
                {title}
              </span>
              {isCustomized ? (
                <span className="bg-gold/15 text-gold-dim dark:bg-gold/10 dark:text-gold inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  Custom <span className="sr-only">settings applied</span>
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground truncate text-sm font-normal">
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
                ? "bg-gold/5 text-muted-foreground dark:bg-gold/5"
                : "from-gold to-gold-dim shadow-gold/25 bg-linear-to-r via-amber-500 text-white shadow-lg",
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

      <div className="via-gold/20 h-px bg-linear-to-r from-transparent to-transparent" />

      <div className="space-y-5">
        {cardProps && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border p-4 shadow-sm",
              useCustomPanelClass,
            )}
          >
            <div className="flex items-center gap-3">
              {cardProps.useCustomSettings ? (
                <ToggleRight className="text-gold h-5 w-5" aria-hidden="true" />
              ) : (
                <ToggleLeft
                  className="text-muted-foreground h-5 w-5"
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
              className="data-[state=checked]:bg-gold"
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
