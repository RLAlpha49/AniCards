"use client";

import { CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";

interface SelectionCounterProps {
  selectedCount: number;
  onSelectAllEnabled: () => void;
  groupOptions?: ReadonlyArray<{ value: string; label: string }>;
  onSelectGroup?: (groupName: string) => void;
}

/**
 * Pure UI component that renders the selection counter and "Select all enabled" control.
 * State and handlers are owned by the parent; this component only renders given props.
 */
export function SelectionCounter({
  selectedCount,
  onSelectAllEnabled,
  groupOptions,
  onSelectGroup,
}: Readonly<SelectionCounterProps>) {
  return (
    <div className="
      flex items-center gap-2
      sm:border-r sm:border-gold/20 sm:pr-3
      dark:sm:border-gold/15
    ">
      <div className="flex size-8 items-center justify-center bg-gold/15 dark:bg-gold/10">
        <CheckSquare className="size-4 text-gold-dim dark:text-gold" />
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          {selectedCount} selected
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectAllEnabled}
            className="
              justify-start px-2.5 text-xs text-gold-dim
              hover:bg-gold/8 hover:text-gold
              dark:text-gold
              dark:hover:bg-gold/10 dark:hover:text-gold
            "
            aria-label="Select all enabled cards"
            aria-keyshortcuts="Control+A Meta+A"
            title="Select all enabled (Ctrl/Cmd+A)"
          >
            Select all enabled
          </Button>

          {groupOptions && groupOptions.length > 0 && onSelectGroup ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="
                    justify-start px-2.5 text-xs text-gold-dim
                    hover:bg-gold/8 hover:text-gold
                    dark:text-gold
                    dark:hover:bg-gold/10 dark:hover:text-gold
                  "
                  aria-label="Select cards by category"
                >
                  Select by category
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1.5" align="start" side="top">
                <div className="flex flex-col gap-0.5">
                  {groupOptions.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="ghost"
                      size="sm"
                      className="h-9 justify-start px-2.5 text-sm"
                      onClick={() => onSelectGroup(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>
    </div>
  );
}
