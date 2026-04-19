"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Root primitive for a transient Popover used to display contextual UI.
 * @source
 */
const Popover = PopoverPrimitive.Root;

/**
 * Trigger element for the Popover; opens or toggles the popover content.
 * @source
 */
const PopoverTrigger = PopoverPrimitive.Trigger;

const POPOVER_COLLISION_PADDING = 12;

/**
 * Content area for the popover. Accepts alignment and offset props to position the popover.
 * @source
 */
const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(
  (
    {
      className,
      align = "center",
      sideOffset = 4,
      collisionPadding = POPOVER_COLLISION_PADDING,
      ...props
    },
    ref,
  ) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          `
            z-50 w-72 max-w-full overflow-y-auto overscroll-contain border bg-popover p-4
            text-popover-foreground shadow-md outline-none
            data-[side=bottom]:slide-in-from-top-2
            data-[side=left]:slide-in-from-right-2
            data-[side=right]:slide-in-from-left-2
            data-[side=top]:slide-in-from-bottom-2
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
          `,
          "safe-area-overlay-viewport",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverContent, PopoverTrigger };
