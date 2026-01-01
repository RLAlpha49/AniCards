"use client";

import { memo } from "react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { GripVertical, Info, Settings } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
  MathTooltipContent,
  containsMath,
} from "@/components/MathTooltipContent";
import { cn } from "@/lib/utils";
import type { CardTileDragHandleProps } from "../CardCategorySection";

interface CardTileHeaderProps {
  label: string;
  enabled: boolean;
  isCustomized?: boolean;
  usesCustomSettings?: boolean;
  isModified?: boolean;
  onToggleEnabled: (checked: boolean) => void;
  tooltipContent?: string;
  isSelected: boolean;
  onToggleSelection: (checked: boolean | "indeterminate") => void;
  onOpenSettings: () => void;

  dragHandleProps?: CardTileDragHandleProps;
}

export const CardTileHeader = memo(function CardTileHeader({
  label,
  enabled,
  isCustomized = false,
  usesCustomSettings = false,
  isModified = false,
  onToggleEnabled,
  tooltipContent,
  isSelected,
  onToggleSelection,
  onOpenSettings,
  dragHandleProps,
}: Readonly<CardTileHeaderProps>) {
  let statusDotClass = "bg-slate-300 dark:bg-slate-600";
  if (enabled) statusDotClass = "bg-emerald-500";
  if (isModified) statusDotClass = "bg-amber-500";

  return (
    <div className="flex items-center justify-between border-b border-slate-200/50 bg-white/60 px-4 py-3.5 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/30">
      <div className="flex min-w-0 items-center gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={onToggleEnabled}
          className="data-[state=checked]:bg-blue-500"
          aria-label={`Toggle ${label} card`}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900",
              statusDotClass,
            )}
            aria-hidden="true"
          />
          <h4
            className={cn(
              "truncate text-sm font-semibold tracking-tight transition-colors",
              enabled
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400",
            )}
          >
            {label}
          </h4>

          {enabled && isModified ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Unsaved <span className="sr-only">changes</span>
            </span>
          ) : null}

          {enabled && (usesCustomSettings || isCustomized) ? (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              Custom <span className="sr-only">settings applied</span>
            </span>
          ) : null}

          {tooltipContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex-shrink-0 rounded-full p-0.5 transition-colors",
                    "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                  )}
                  aria-label={`Info about ${label}`}
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs text-xs leading-relaxed"
                sideOffset={8}
              >
                {containsMath(tooltipContent) ? (
                  <MathTooltipContent content={tooltipContent} />
                ) : (
                  <p>{tooltipContent}</p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {dragHandleProps ? (
          <button
            type="button"
            ref={dragHandleProps.setActivatorNodeRef}
            aria-label={`Reorder ${label}`}
            title="Drag to reorder"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors",
              "hover:bg-slate-50 hover:text-slate-700",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
              "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              "cursor-grab touch-none active:cursor-grabbing",
            )}
            {...dragHandleProps.attributes}
            {...(dragHandleProps.listeners as Record<string, unknown>)}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        {enabled && (
          <>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              className={cn(
                "h-6 w-6 rounded-lg border-2 transition-all",
                "data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500",
                "hover:border-blue-400",
                !isSelected &&
                  "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800",
              )}
              aria-label={`Select ${label} card`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="h-9 w-9 rounded-xl p-0 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"
              title="Card settings"
              aria-label={`Open settings for ${label}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

CardTileHeader.displayName = "CardTileHeader";
