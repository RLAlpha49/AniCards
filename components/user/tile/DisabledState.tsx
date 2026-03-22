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
        <div className="
          mx-auto mb-3 flex size-10 items-center justify-center border border-gold/15 bg-gold/3
          dark:border-gold/10 dark:bg-gold/3
        ">
          <EyeOff className="size-5 text-gold/40" aria-hidden="true" />
        </div>
        <p className="font-display text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
          Card disabled
        </p>
      </div>
    </output>
  );
});

DisabledState.displayName = "DisabledState";
