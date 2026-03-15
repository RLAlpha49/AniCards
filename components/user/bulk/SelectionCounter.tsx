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
    <div className="flex items-center gap-2 sm:border-r sm:border-slate-200 sm:pr-3 dark:sm:border-slate-700">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
        <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAllEnabled}
            className="text-left text-xs text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:text-blue-400 dark:hover:text-blue-300"
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
                  className="text-left text-xs text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:text-blue-400 dark:hover:text-blue-300"
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
                      className="h-9 justify-start rounded-md px-2.5 text-sm"
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
