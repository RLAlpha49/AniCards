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

interface ErrorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  className?: string;
}

// Reusable error dialog component using shadcn/ui Dialog
export function ErrorPopup({
  isOpen,
  onClose,
  title,
  description,
  className,
}: ErrorPopupProps) {
  // Track error when popup opens
  if (isOpen) {
    trackError(title, description);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* 
				Dialog styling:
				- Red border for error indication
				- Inherits additional className props
				- Fixed max-width for consistency
			*/}
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
