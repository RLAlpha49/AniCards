"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const MOBILE_CHECKBOX_HIT_AREA = "max-md:-inset-[0.875rem]";

/**
 * Accessible Checkbox wrapper using Radix primitives.
 * Includes visual indicator icon and supports all native checkbox props.
 * @source
 */
const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, disabled, ...props }, forwardedRef) => {
  const checkboxRef =
    React.useRef<React.ComponentRef<typeof CheckboxPrimitive.Root>>(null);

  const setCheckboxRef = React.useCallback(
    (node: React.ComponentRef<typeof CheckboxPrimitive.Root> | null) => {
      checkboxRef.current = node;

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
      checkboxRef.current?.focus();
    },
    [],
  );

  const handleHitAreaClick = React.useCallback(() => {
    if (disabled) return;

    checkboxRef.current?.click();
    checkboxRef.current?.focus();
  }, [disabled]);

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        className={cn(
          "absolute hidden rounded-[inherit] max-md:block",
          MOBILE_CHECKBOX_HIT_AREA,
        )}
        onMouseDown={handleHitAreaMouseDown}
        onClick={handleHitAreaClick}
      />
      <CheckboxPrimitive.Root
        ref={setCheckboxRef}
        disabled={disabled}
        className={cn(
          `
            peer relative z-10 size-4 shrink-0 border border-primary shadow-sm
            focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
            disabled:cursor-not-allowed disabled:opacity-50
            data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground
          `,
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn("flex items-center justify-center text-current")}
        >
          <Check className="size-4" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </span>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
