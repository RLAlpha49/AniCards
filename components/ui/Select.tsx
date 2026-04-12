"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Root primitive for a Select component built on Radix.
 * @source
 */
const Select = SelectPrimitive.Root;

/**
 * Presentation component showing the currently selected value.
 * @source
 */
const SelectValue = SelectPrimitive.Value;

const SELECT_OVERLAY_COLLISION_PADDING = 12;
const SELECT_OVERLAY_MAX_HEIGHT =
  "min(24rem, calc(var(--shell-viewport-min-height) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem))";
const SELECT_OVERLAY_MAX_WIDTH =
  "calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 1rem)";

/**
 * Trigger used to open the select dropdown; wraps the native trigger.
 * @source
 */
const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      `
        flex h-9 w-full touch-manipulation-safe items-center justify-between border border-input
        bg-background px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background
        placeholder:text-muted-foreground
        focus:ring-1 focus:ring-ring focus:outline-none
        disabled:cursor-not-allowed disabled:opacity-50
        max-md:min-h-11
        [&>span]:line-clamp-1
      `,
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/** Button rendered at the top of the list when it scrolls; uses chevron icon. @source */
const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      `
        flex min-h-11 cursor-pointer touch-manipulation-safe items-center justify-center py-2
        text-muted-foreground
        hover:text-foreground
        sm:min-h-8 sm:py-1.5
      `,
      className,
    )}
    {...props}
  >
    <ChevronUp className="size-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

/** Button rendered at the bottom of the list when it scrolls; uses chevron icon. @source */
const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      `
        flex min-h-11 cursor-pointer touch-manipulation-safe items-center justify-center py-2
        text-muted-foreground
        hover:text-foreground
        sm:min-h-8 sm:py-1.5
      `,
      className,
    )}
    {...props}
  >
    <ChevronDown className="size-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

/**
 * Content area for select options; handles positioning and viewport.
 * @source
 */
const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(
  (
    {
      className,
      children,
      position = "popper",
      collisionPadding = SELECT_OVERLAY_COLLISION_PADDING,
      style,
      ...props
    },
    ref,
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          `
            relative z-50 min-w-32 overflow-hidden overscroll-contain border border-border/60
            bg-popover text-foreground shadow-xl shadow-black/10 backdrop-blur-md
            data-[side=bottom]:slide-in-from-top-2
            data-[side=left]:slide-in-from-right-2
            data-[side=right]:slide-in-from-left-2
            data-[side=top]:slide-in-from-bottom-2
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
            dark:shadow-black/30
          `,
          position === "popper" &&
            `
              data-[side=bottom]:translate-y-1
              data-[side=left]:-translate-x-1
              data-[side=right]:translate-x-1
              data-[side=top]:-translate-y-1
            `,
          className,
        )}
        position={position}
        collisionPadding={collisionPadding}
        style={{
          maxHeight: SELECT_OVERLAY_MAX_HEIGHT,
          maxWidth: SELECT_OVERLAY_MAX_WIDTH,
          ...style,
        }}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "max-h-[inherit] overscroll-contain p-1.5",
            position === "popper" &&
              "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

/**
 * Label element used inside the select content to provide group headings.
 * @source
 */
const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
      className,
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

/**
 * Selectable item representing an option in the select dropdown.
 * @source
 */
const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      `
        relative flex min-h-11 w-full cursor-pointer touch-manipulation-safe items-center py-3 pr-10
        pl-3.5 text-sm font-medium transition-colors outline-none select-none
        sm:min-h-9 sm:py-2 sm:pr-9 sm:pl-3
      `,
      "text-foreground",
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      `
        data-[state=checked]:bg-gold/10 data-[state=checked]:text-gold
        dark:data-[state=checked]:bg-gold/15 dark:data-[state=checked]:text-gold
      `,
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute right-2.5 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-gold" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

/**
 * Divider between groups or sections inside the select component.
 * @source
 */
const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1.5 h-px bg-border/80", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
