"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackError, safeTrack } from "@/lib/utils/google-analytics";
import { useEffect } from "react";
import type { RecoverySuggestion } from "@/lib/error-messages";

/**
 * Props for the error dialog component.
 * @property isOpen - Whether the dialog is visible.
 * @property onClose - Callback invoked when dialog is closed.
 * @property title - Error title shown to the user.
 * @property description - Detailed error message.
 * @property suggestions - Optional recovery suggestions with actions.
 * @property onRetry - Optional callback when user clicks retry.
 * @property isRetryable - Whether the error allows retry attempts.
 * @property className - Optional additional class names.
 * @source
 */
interface ErrorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  suggestions?: RecoverySuggestion[];
  onRetry?: () => void;
  isRetryable?: boolean;
  className?: string;
}

/**
 * Individual recovery suggestion component.
 * @source
 */
function RecoverySuggestionItem({
  suggestion,
}: Readonly<{
  suggestion: RecoverySuggestion;
}>) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
      <div className="flex-1">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {suggestion.title}
        </h4>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {suggestion.description}
        </p>
        {suggestion.actionUrl && suggestion.actionLabel && (
          <a
            href={suggestion.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {suggestion.actionLabel} →
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Reusable error dialog that tracks and displays error information with recovery suggestions.
 * When opened, the component reports the error via analytics.
 * Features actionable recovery steps and optional retry functionality.
 * @param props - Dialog properties.
 * @returns A configured dialog element.
 * @source
 */
export function ErrorPopup({
  isOpen,
  onClose,
  title,
  description,
  suggestions,
  onRetry,
  isRetryable,
  className,
}: Readonly<ErrorPopupProps>) {
  // Track error when popup opens so analytics can capture details.
  useEffect(() => {
    if (isOpen) {
      safeTrack(() => trackError(title, description));
    }
  }, [isOpen, title, description]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Dialog styling: red border for emphasis, accepts additional classes. */}
      <DialogContent
        className={cn("border-red-500 sm:max-w-[500px]", className)}
      >
        <DialogHeader>
          {/* Error header with icon and title */}
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-red-500" />
            <DialogTitle className="text-red-500">{title}</DialogTitle>
          </div>

          {/* Error description - uses text-foreground for better readability */}
          <DialogDescription className="pt-2 text-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Recovery suggestions section */}
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              What you can do:
            </h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <RecoverySuggestionItem
                  key={`${suggestion.title}-${index}`}
                  suggestion={suggestion}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 sm:flex-none"
          >
            Close
          </Button>
          {isRetryable && onRetry && (
            <Button
              variant="default"
              onClick={onRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 sm:flex-none"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
