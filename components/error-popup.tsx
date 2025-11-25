"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackError } from "@/lib/utils/google-analytics";

/**
 * Props for the error dialog component.
 * @property isOpen - Whether the dialog is visible.
 * @property onClose - Callback invoked when dialog is closed.
 * @property title - Error title shown to the user.
 * @property description - Detailed error message.
 * @property className - Optional additional class names.
 * @source
 */
interface ErrorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  className?: string;
}

// Reusable error dialog component using shadcn/ui Dialog
/**
 * Reusable error dialog that tracks and displays error information.
 * When opened, the component reports the error via analytics.
 * @param props - Dialog properties.
 * @returns A configured dialog element.
 * @source
 */
export function ErrorPopup({
  isOpen,
  onClose,
  title,
  description,
  className,
}: Readonly<ErrorPopupProps>) {
  // Track error when popup opens so analytics can capture details.
  if (isOpen) {
    trackError(title, description);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Dialog styling: red border for emphasis, accepts additional classes. */}
      <DialogContent
        className={cn("border-red-500 sm:max-w-[425px]", className)}
      >
        <DialogHeader>
          {/* Error header with icon and title */}
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <DialogTitle className="text-red-500">{title}</DialogTitle>
          </div>

          {/* Error description - uses text-foreground for better readability */}
          <DialogDescription className="pt-2 text-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
