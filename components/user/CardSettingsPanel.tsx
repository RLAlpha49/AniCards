"use client";

import {
  Loader2,
  Save,
  Settings2,
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
  tools?: React.ReactNode;
  className?: string;
}

interface GlobalPanelProps extends BasePanelProps {
  mode: "global";
  onSaveAll?: () => void | Promise<void>;
  saveAllDisabled?: boolean;
  isSaving?: boolean;
}

interface CardPanelProps extends BasePanelProps {
  mode: "card";
  idPrefix: string;
  useCustomSettings: boolean;
  isCustomized?: boolean;
  onUseCustomSettingsChange: (enabled: boolean) => void;
  customSettingsDisabledMessage?: string;
}

export type CardSettingsPanelProps = GlobalPanelProps | CardPanelProps;

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
    <div className="
      border border-dashed border-border/50 py-10 text-center text-sm text-muted-foreground
    ">
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
      {/* ── Header ──────────────────────────────────────── */}
      <div className="
        flex items-center justify-between gap-4 border border-border/50 bg-card/60 p-4
      ">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center transition-colors",
              isCustomized
                ? "bg-gold text-white shadow-sm shadow-gold/20"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Settings2 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="
                block truncate font-display text-lg font-semibold tracking-tight text-foreground
              ">
                {title}
              </span>
              {isCustomized && (
                <span className="
                  inline-flex items-center bg-gold/15 px-2 py-0.5 text-[10px] font-semibold
                  tracking-wider text-gold-dim uppercase
                  dark:bg-gold/10 dark:text-gold
                ">
                  Custom
                  <span className="sr-only"> settings applied</span>
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
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
              "shrink-0 transition-all",
              globalProps.saveAllDisabled || !isSettingsValid
                ? "bg-muted text-muted-foreground"
                : "bg-gold text-white shadow-sm shadow-gold/20 hover:bg-gold/90",
            )}
          >
            {globalProps.isSaving ? (
              <Loader2
                className="mr-1.5 size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save className="mr-1.5 size-3.5" aria-hidden="true" />
            )}
            Save All
          </Button>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Custom Settings Toggle (card mode) */}
        {cardProps && (
          <div
            className={cn(
              "flex items-center justify-between border p-4 transition-all",
              cardProps.useCustomSettings
                ? "border-gold/30 bg-gold/5 dark:border-gold/20 dark:bg-gold/5"
                : "border-border/50 bg-muted/20",
            )}
          >
            <div className="flex items-center gap-3">
              {cardProps.useCustomSettings ? (
                <ToggleRight
                  className="size-5 shrink-0 text-gold"
                  aria-hidden="true"
                />
              ) : (
                <ToggleLeft
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    cardProps.useCustomSettings
                      ? "text-gold-dim dark:text-gold"
                      : "text-foreground",
                  )}
                >
                  Use Custom Settings
                </span>
                <p
                  className={cn(
                    "text-xs",
                    cardProps.useCustomSettings
                      ? "text-gold-dim/70 dark:text-gold/70"
                      : "text-muted-foreground",
                  )}
                >
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

        {/* Tools */}
        {tools ? <div>{tools}</div> : null}

        {/* Settings Body */}
        {settingsBody}
      </div>
    </div>
  );
}
