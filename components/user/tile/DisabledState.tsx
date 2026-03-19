"use client";

import { EyeOff } from "lucide-react";
import { memo } from "react";

export const DisabledState = memo(function DisabledState() {
  return (
    <output
      className="flex items-center justify-center py-8"
      aria-label="Card disabled"
    >
      <div className="text-center">
        <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 mx-auto mb-3 flex h-10 w-10 items-center justify-center border">
          <EyeOff className="text-gold/40 h-5 w-5" aria-hidden="true" />
        </div>
        <p className="font-display text-muted-foreground text-[10px] tracking-[0.15em] uppercase">
          Card disabled
        </p>
      </div>
    </output>
  );
});

DisabledState.displayName = "DisabledState";
