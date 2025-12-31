"use client";

import { memo } from "react";
import { EyeOff } from "lucide-react";

export const DisabledState = memo(function DisabledState() {
  return (
    <output
      className="flex items-center justify-center py-6"
      aria-label="Card disabled"
    >
      <div className="text-center">
        <EyeOff
          className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600"
          aria-hidden="true"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Card disabled
        </p>
      </div>
    </output>
  );
});

DisabledState.displayName = "DisabledState";
