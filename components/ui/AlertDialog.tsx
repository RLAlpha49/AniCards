"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";

import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const ALERT_DIALOG_SAFE_AREA_PADDING = {
  paddingTop: "max(0.5rem, calc(env(safe-area-inset-top) + 0.5rem))",
  paddingRight: "max(0.5rem, calc(env(safe-area-inset-right) + 0.5rem))",
  paddingBottom: "max(0.5rem, calc(env(safe-area-inset-bottom) + 0.5rem))",
  paddingLeft: "max(0.5rem, calc(env(safe-area-inset-left) + 0.5rem))",
} satisfies React.CSSProperties;

/**
 * AlertDialog root primitive providing modal state for confirmation dialogs.
 * @source
 */
const AlertDialog = AlertDialogPrimitive.Root;

/**
 * Trigger element for opening the alert dialog.
 * @source
 */
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

/**
 * Portal wrapper for the alert dialog content.
 * @source
 */
const AlertDialogPortal = AlertDialogPrimitive.Portal;

/**
 * The overlay displayed behind the alert dialog.
 * @source
 */
const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 imperial-overlay",
      `
        data-[state=closed]:animate-out data-[state=closed]:fade-out-0
        data-[state=open]:animate-in data-[state=open]:fade-in-0
      `,
      className,
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

/**
 * The alert dialog content wrapper.
 * @source
 */
const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={ALERT_DIALOG_SAFE_AREA_PADDING}
    >
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          `
            pointer-events-auto relative z-50 grid max-h-full w-full max-w-lg overflow-y-auto
            overscroll-contain
          `,
          "border-2 border-gold/15 bg-background",
          "shadow-[0_24px_80px_-12px_hsl(var(--gold)/0.12),0_8px_24px_-4px_hsl(0_0%_0%/0.25)]",
          "gap-4 p-4 duration-300 sm:p-6",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </div>
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

/**
 * Header region for alert dialog content.
 * @source
 */
const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      "border-b border-gold/10 pb-4",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

/**
 * Footer region for alert dialog content; commonly holds action buttons.
 * @source
 */
const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      "border-t border-gold/10 pt-4",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

/**
 * Title element for alert dialogs.
 * @source
 */
const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-medium tracking-wide", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

/**
 * Description text for an alert dialog.
 * @source
 */
const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("font-body-serif text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

/**
 * Action button for alert dialog; typically the destructive/confirm action.
 * @source
 */
const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      buttonVariants(),
      "w-full touch-manipulation-safe sm:w-auto",
      className,
    )}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

/**
 * Cancel button for alert dialog; closes the dialog without action.
 * @source
 */
const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      `
        mt-2 w-full touch-manipulation-safe border-gold/20
        hover:border-gold/40 hover:bg-gold/5
        sm:mt-0 sm:w-auto
      `,
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
