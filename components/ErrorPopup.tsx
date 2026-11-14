"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, RotateCcw } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { trackError, safeTrack } from "@/lib/utils/google-analytics";
import { useEffect } from "react";
import type { RecoverySuggestion } from "@/lib/error-messages";
import styles from "./ErrorPopup.module.css";

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
 * One numbered recovery step on the error plate.
 * @source
 */
function RecoveryStep({
  suggestion,
}: Readonly<{ suggestion: RecoverySuggestion }>) {
  return (
    <li className={styles.item}>
      <div>
        <h4 className={styles.itemTitle}>{suggestion.title}</h4>
        <p className={styles.itemNote}>{suggestion.description}</p>
        {suggestion.actionUrl && suggestion.actionLabel && (
          <a
            href={suggestion.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.itemLink}
          >
            {suggestion.actionLabel}
            <ArrowRight aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
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
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={cn(styles.plate, className)}>
          {/* Seal: 誤 (error), reading at a glance without any copy. */}
          <span className={styles.seal} aria-hidden="true">
            誤
          </span>

          <div className={styles.body}>
            <p className={styles.edition}>
              <span>Errata</span>
              <span className={styles.rule} aria-hidden="true" />
              <span>{isRetryable ? "Retryable" : "Not retryable"}</span>
            </p>

            <DialogPrimitive.Title className={styles.title}>
              {title}
            </DialogPrimitive.Title>

            <DialogPrimitive.Description className={styles.note}>
              {description}
            </DialogPrimitive.Description>

            {suggestions && suggestions.length > 0 && (
              <div className={styles.suggestions}>
                <h3 className={styles.suggestionsHead}>What you can do</h3>
                <ol className={styles.list}>
                  {suggestions.map((suggestion, index) => (
                    <RecoveryStep
                      key={`${suggestion.title}-${index}`}
                      suggestion={suggestion}
                    />
                  ))}
                </ol>
              </div>
            )}

            <div className={styles.actions}>
              <DialogPrimitive.Close className={styles.quiet}>
                Close
              </DialogPrimitive.Close>
              {isRetryable && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className={styles.primary}
                >
                  <RotateCcw aria-hidden="true" />
                  Try Again
                </button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
