"use client";

import { EyeOff } from "lucide-react";

export function DisabledState() {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="text-center">
        <EyeOff className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Card disabled
        </p>
      </div>
    </div>
  );
}
