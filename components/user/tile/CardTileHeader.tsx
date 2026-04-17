"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  GripVertical,
  Info,
  Settings,
} from "lucide-react";
import { memo, useCallback, useState } from "react";

import {
  containsMath,
  MathTooltipContent,
  prefetchMathTooltipContent,
} from "@/components/MathTooltipContent";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Switch } from "@/components/ui/Switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

import type { CardTileDragHandleProps } from "../CardCategorySection";

export type CardTileReorderControls = {
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onMoveEarlier: () => void;
  onMoveLater: () => void;
  position: number;
  total: number;
};

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
  reorderControls?: CardTileReorderControls;
  preferTapInfoDisclosure?: boolean;
}

function getStatusDotClass(params: {
  enabled: boolean;
  isModified: boolean;
}): string {
  if (params.isModified) {
    return "bg-amber-500";
  }

  if (params.enabled) {
    return "bg-gold";
  }

  return "bg-gold/30 dark:bg-gold/20";
}

function getInfoTooltipContent(
  tooltipContent: string,
  hasMathTooltip: boolean,
) {
  if (hasMathTooltip) {
    return <MathTooltipContent content={tooltipContent} />;
  }

  return <p>{tooltipContent}</p>;
}

function CardHeaderStatusBadge(
  props: Readonly<{
    className: string;
    label: string;
    srText: string;
    visible: boolean;
  }>,
) {
  if (!props.visible) {
    return null;
  }

  return (
    <span className={props.className}>
      {props.label} <span className="sr-only">{props.srText}</span>
    </span>
  );
}

function CardHeaderInfoDisclosure(
  props: Readonly<{
    hasMathTooltip: boolean;
    isOpen: boolean;
    label: string;
    onOpenChange: (open: boolean) => void;
    prefetchMathTooltip: () => void;
    preferTapInfoDisclosure: boolean;
    tooltipContent?: string;
  }>,
) {
  if (!props.tooltipContent) {
    return null;
  }

  const infoContent = getInfoTooltipContent(
    props.tooltipContent,
    props.hasMathTooltip,
  );
  const trigger = (
    <button
      type="button"
      data-tour="card-info"
      onPointerEnter={props.prefetchMathTooltip}
      onFocus={props.prefetchMathTooltip}
      className={cn(
        `
          flex size-11 shrink-0 touch-manipulation-safe items-center justify-center rounded-full
          text-muted-foreground transition-colors
          sm:size-6
        `,
        "hover:bg-gold/5 hover:text-foreground",
        `
          focus:outline-none
          focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1
        `,
      )}
      aria-label={`Info about ${props.label}`}
    >
      <Info className="size-4 sm:size-3.5" aria-hidden="true" />
    </button>
  );

  if (props.preferTapInfoDisclosure) {
    return (
      <Popover open={props.isOpen} onOpenChange={props.onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="max-w-xs text-xs/relaxed"
        >
          {infoContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip
      onOpenChange={(open) => {
        if (open) {
          props.prefetchMathTooltip();
        }
      }}
    >
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs text-xs/relaxed"
        sideOffset={8}
      >
        {infoContent}
      </TooltipContent>
    </Tooltip>
  );
}

function CardHeaderReorderControls(
  props: Readonly<{
    isOpen: boolean;
    label: string;
    onOpenChange: (open: boolean) => void;
    reorderControls?: CardTileReorderControls;
  }>,
) {
  if (!props.reorderControls || props.reorderControls.total <= 1) {
    return null;
  }

  return (
    <Popover open={props.isOpen} onOpenChange={props.onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-tour="card-reorder-controls"
          className="
            size-11 touch-manipulation-safe p-0 text-muted-foreground transition-colors
            hover:bg-gold/10 hover:text-gold
            sm:size-9
            dark:hover:bg-gold/10
          "
          aria-label={`Reorder options for ${props.label}`}
          title="Reorder without dragging"
        >
          <ChevronsUpDown className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" side="bottom">
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          Position {props.reorderControls.position} of{" "}
          {props.reorderControls.total}
        </p>

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!props.reorderControls.canMoveEarlier}
            className="h-12 min-h-12 justify-start"
            aria-label={`Move ${props.label} earlier`}
            onClick={() => {
              props.reorderControls?.onMoveEarlier();
              props.onOpenChange(false);
            }}
          >
            <ArrowUp className="mr-2 size-4" aria-hidden="true" />
            Move earlier
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!props.reorderControls.canMoveLater}
            className="h-12 min-h-12 justify-start"
            aria-label={`Move ${props.label} later`}
            onClick={() => {
              props.reorderControls?.onMoveLater();
              props.onOpenChange(false);
            }}
          >
            <ArrowDown className="mr-2 size-4" aria-hidden="true" />
            Move later
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
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
  reorderControls,
  preferTapInfoDisclosure = false,
}: Readonly<CardTileHeaderProps>) {
  const hasMathTooltip = Boolean(
    tooltipContent && containsMath(tooltipContent),
  );
  const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);
  const [isReorderPopoverOpen, setIsReorderPopoverOpen] = useState(false);

  const prefetchMathTooltip = useCallback(() => {
    if (!hasMathTooltip) return;
    prefetchMathTooltipContent();
  }, [hasMathTooltip]);

  const statusDotClass = getStatusDotClass({ enabled, isModified });

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

          <CardHeaderStatusBadge
            visible={enabled && isModified}
            label="Unsaved"
            srText="changes"
            className="
              inline-flex items-center border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px]
              font-semibold text-amber-800
              dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200
            "
          />

          <CardHeaderStatusBadge
            visible={enabled && isCustomized}
            label="Custom"
            srText="settings applied"
            className="
              inline-flex items-center border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px]
              font-semibold text-gold-dim
              dark:border-gold/20 dark:bg-gold/10 dark:text-gold
            "
          />

          <CardHeaderInfoDisclosure
            label={label}
            tooltipContent={tooltipContent}
            hasMathTooltip={hasMathTooltip}
            preferTapInfoDisclosure={preferTapInfoDisclosure}
            isOpen={isInfoPopoverOpen}
            onOpenChange={(open) => {
              setIsInfoPopoverOpen(open);
              if (open) {
                prefetchMathTooltip();
              }
            }}
            prefetchMathTooltip={prefetchMathTooltip}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CardHeaderReorderControls
          label={label}
          reorderControls={reorderControls}
          isOpen={isReorderPopoverOpen}
          onOpenChange={setIsReorderPopoverOpen}
        />

        {dragHandleProps ? (
          <button
            type="button"
            ref={dragHandleProps.setActivatorNodeRef}
            data-tour="card-drag-handle"
            aria-label={`Reorder ${label}`}
            title="Drag to reorder"
            className={cn(
              `
                flex size-11 touch-manipulation-safe items-center justify-center border
                border-gold/20 bg-background text-muted-foreground shadow-sm transition-colors
                sm:size-10
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
                size-11 touch-manipulation-safe p-0 transition-colors
                hover:bg-gold/10 hover:text-gold
                sm:size-9
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
