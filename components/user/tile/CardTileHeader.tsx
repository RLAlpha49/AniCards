"use client";

import { GripVertical, Info, Settings } from "lucide-react";
import { memo } from "react";

import {
  containsMath,
  MathTooltipContent,
} from "@/components/MathTooltipContent";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

import type { CardTileDragHandleProps } from "../CardCategorySection";

interface CardTileHeaderProps {
  label: string;
  enabled: boolean;
  isCustomized?: boolean;
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
  isModified = false,
  onToggleEnabled,
  tooltipContent,
  isSelected,
  onToggleSelection,
  onOpenSettings,
  dragHandleProps,
}: Readonly<CardTileHeaderProps>) {
  let statusDotClass = "bg-gold/30 dark:bg-gold/20";
  if (enabled) statusDotClass = "bg-gold";
  if (isModified) statusDotClass = "bg-amber-500";

  return (
    <div className="
      flex items-center justify-between border-b-2 border-gold/15 bg-gold/3 px-4 py-3.5
      backdrop-blur-sm
      dark:border-gold/10 dark:bg-gold/3
    ">
      <div className="flex min-w-0 items-center gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={onToggleEnabled}
          className="data-[state=checked]:bg-gold"
          data-tour="card-enable-toggle"
          aria-label={`Toggle ${label} card`}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-background",
              statusDotClass,
            )}
            aria-hidden="true"
          />
          <h4
            className={cn(
              "truncate font-display text-sm tracking-wider uppercase transition-colors",
              enabled ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </h4>

          {enabled && isModified ? (
            <span className="
              inline-flex items-center border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px]
              font-semibold text-amber-800
              dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200
            ">
              Unsaved <span className="sr-only">changes</span>
            </span>
          ) : null}

          {enabled && isCustomized ? (
            <span className="
              inline-flex items-center border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px]
              font-semibold text-gold-dim
              dark:border-gold/20 dark:bg-gold/10 dark:text-gold
            ">
              Custom <span className="sr-only">settings applied</span>
            </span>
          ) : null}

          {tooltipContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-tour="card-info"
                  className={cn(
                    "shrink-0 p-0.5 transition-colors",
                    "text-muted-foreground hover:text-foreground",
                    `
                      focus:outline-none
                      focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1
                    `,
                  )}
                  aria-label={`Info about ${label}`}
                >
                  <Info className="size-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs text-xs/relaxed"
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
            data-tour="card-drag-handle"
            aria-label={`Reorder ${label}`}
            title="Drag to reorder"
            className={cn(
              `
                flex size-10 items-center justify-center border border-gold/20 bg-background
                text-muted-foreground shadow-sm transition-colors
              `,
              "hover:bg-gold/5 hover:text-foreground",
              `
                focus:outline-none
                focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1
              `,
              "dark:border-gold/15",
              "cursor-grab touch-none active:cursor-grabbing",
            )}
            {...dragHandleProps.attributes}
            {...(dragHandleProps.listeners as Record<string, unknown>)}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        ) : null}

        {enabled && (
          <>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              data-tour="card-select"
              className={cn(
                "size-6 border-2 transition-all",
                "data-[state=checked]:border-gold data-[state=checked]:bg-gold",
                "hover:border-gold/60",
                !isSelected &&
                  "border-gold/20 bg-background dark:border-gold/15",
              )}
              aria-label={`Select ${label} card`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              data-tour="card-settings"
              className="
                size-9 p-0 transition-colors
                hover:bg-gold/10 hover:text-gold
                dark:hover:bg-gold/10
              "
              title="Card settings"
              aria-label={`Open settings for ${label}`}
            >
              <Settings className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

CardTileHeader.displayName = "CardTileHeader";
