"use client";

import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { Info, Settings } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
  MathTooltipContent,
  containsMath,
} from "@/components/MathTooltipContent";
import { cn } from "@/lib/utils";

interface CardTileHeaderProps {
  label: string;
  enabled: boolean;
  onToggleEnabled: () => void;
  tooltipContent?: string | null;
  isSelected: boolean;
  onToggleSelection: () => void;
  onOpenSettings: () => void;
}

export function CardTileHeader({
  label,
  enabled,
  onToggleEnabled,
  tooltipContent,
  isSelected,
  onToggleSelection,
  onOpenSettings,
}: Readonly<CardTileHeaderProps>) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/50 px-4 py-3 dark:border-slate-700/50">
      <div className="flex items-center gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={() => onToggleEnabled()}
          className="data-[state=checked]:bg-blue-500"
          aria-label={`Toggle ${label} card`}
        />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h4
            className={cn(
              "truncate text-sm font-medium transition-colors",
              enabled
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400",
            )}
          >
            {label}
          </h4>
          {tooltipContent && (
            <TooltipProvider delayDuration={200}>
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
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {enabled && (
          <>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              className={cn(
                "h-5 w-5 rounded-md border-2 transition-all",
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
              onClick={() => onOpenSettings()}
              className="h-8 w-8 p-0 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"
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
}
