"use client";

import { CheckSquare } from "lucide-react";

interface SelectionCounterProps {
  selectedCount: number;
  selectAllEnabled: () => void;
}

/**
 * Pure UI component that renders the selection counter and "Select all enabled" control.
 * State and handlers are owned by the parent; this component only renders given props.
 */
export function SelectionCounter({
  selectedCount,
  selectAllEnabled,
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
        <button
          type="button"
          onClick={selectAllEnabled}
          className="text-left text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Select all enabled
        </button>
      </div>
    </div>
  );
}
