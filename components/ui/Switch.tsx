"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";

const MOBILE_SWITCH_HIT_AREA = "max-md:-inset-x-1 max-md:-inset-y-3";

/**
 * Small toggle switch input using Radix primitives.
 * Mirrors native checkbox semantics while exposing Radix props.
 * @source
 */
const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, disabled, ...props }, forwardedRef) => {
  const switchRef =
    React.useRef<React.ComponentRef<typeof SwitchPrimitives.Root>>(null);

  const setSwitchRef = React.useCallback(
    (node: React.ComponentRef<typeof SwitchPrimitives.Root> | null) => {
      switchRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
        return;
      }

      if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const handleHitAreaMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      switchRef.current?.focus();
    },
    [],
  );

  const handleHitAreaClick = React.useCallback(() => {
    if (disabled) return;

    switchRef.current?.click();
    switchRef.current?.focus();
  }, [disabled]);

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        className={cn(
          "absolute hidden rounded-full max-md:block",
          MOBILE_SWITCH_HIT_AREA,
        )}
        onMouseDown={handleHitAreaMouseDown}
        onClick={handleHitAreaClick}
      />
      <SwitchPrimitives.Root
        className={cn(
          `
            peer relative z-10 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
            border-2 border-transparent shadow-sm transition-colors
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            focus-visible:ring-offset-background focus-visible:outline-none
            disabled:cursor-not-allowed disabled:opacity-50
            data-[state=checked]:bg-primary
            data-[state=unchecked]:bg-input
          `,
          className,
        )}
        disabled={disabled}
        {...props}
        ref={setSwitchRef}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            `
              pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0
              transition-transform
              data-[state=checked]:translate-x-4
              data-[state=unchecked]:translate-x-0
            `,
          )}
        />
      </SwitchPrimitives.Root>
    </span>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
