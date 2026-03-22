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
    <div className="sm:border-gold/20 dark:sm:border-gold/15 flex items-center gap-2 sm:border-r sm:pr-3">
      <div className="bg-gold/15 dark:bg-gold/10 flex h-8 w-8 items-center justify-center">
        <CheckSquare className="text-gold-dim dark:text-gold h-4 w-4" />
      </div>

      <div className="flex flex-col">
        <span className="text-foreground text-sm font-semibold">
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAllEnabled}
            className="text-gold-dim hover:text-gold focus-visible:ring-gold/50 dark:text-gold dark:hover:text-gold text-left text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            aria-label="Select all enabled cards"
            aria-keyshortcuts="Control+A Meta+A"
            title="Select all enabled (Ctrl/Cmd+A)"
          >
            Select all enabled
          </button>

          {groupOptions && groupOptions.length > 0 && onSelectGroup ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-gold-dim hover:text-gold focus-visible:ring-gold/50 dark:text-gold dark:hover:text-gold text-left text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  aria-label="Select cards by category"
                >
                  Select by category
                </button>
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
