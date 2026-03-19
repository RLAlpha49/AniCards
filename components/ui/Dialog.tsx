"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dialog root primitive providing modal state for nested dialog elements.
 * @source
 */
const Dialog = DialogPrimitive.Root;

/**
 * Trigger element for opening the dialog; accepts the same props as Radix Trigger.
 * @source
 */
const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Portal wrapper for the dialog content to render outside the normal DOM flow.
 * @source
 */
const DialogPortal = DialogPrimitive.Portal;

/**
 * Close action for the dialog; typically used to hide the dialog.
 * @source
 */
const DialogClose = DialogPrimitive.Close;

/**
 * The overlay displayed behind the dialog to obscure and focus page content.
 * @source
 */
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "imperial-overlay fixed inset-0 z-50",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Props for DialogContent.
 * Adds a small escape hatch to hide the default close button or customize its styling.
 * @source
 */
interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** When true, the default top-right close button is not rendered. */
  hideCloseButton?: boolean;
  /** Optional additional classes applied to the default close button (when shown). */
  closeButtonClassName?: string;
}

/**
 * The dialog content wrapper that holds the dialog UI and close control.
 * It uses Radix primitives to handle focus-trapping and animations.
 * @source
 */
const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      hideCloseButton = false,
      closeButtonClassName,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
          "border-gold/15 bg-background border-2",
          "shadow-[0_24px_80px_-12px_hsl(var(--gold)/0.12),0_8px_24px_-4px_hsl(0_0%_0%/0.25)]",
          "gap-4 p-6 duration-300",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            className={cn(
              "absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center",
              "border-gold/25 text-gold/60 border bg-transparent",
              "transition-all duration-300",
              "hover:border-gold/50 hover:bg-gold/10 hover:text-gold",
              "focus:ring-gold/30 focus:ring-1 focus:outline-none",
              "disabled:pointer-events-none",
              closeButtonClassName,
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Header region for dialog content; typically used for titles and metadata.
 * @source
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      "border-gold/10 border-b pb-4",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

/**
 * Footer region for dialog content; commonly holds action buttons.
 * @source
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      "border-gold/10 border-t pt-4",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

/**
 * Title element for dialogs; used to describe the dialog purpose.
 * @source
 */
const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-display text-lg leading-none font-medium tracking-wide",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * Description text for a dialog; provides additional context to the user.
 * @source
 */
const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("font-body-serif text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
