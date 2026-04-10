"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { cn } from "@/lib/utils";

export type BulkConfirmPreviewItem = {
  cardId: string;
  label: string;
  group?: string;
  enabled?: boolean;
};

interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description?: React.ReactNode;

  confirmLabel: string;
  confirmDestructive?: boolean;

  previewItems: BulkConfirmPreviewItem[];
  totalAffected: number;
  previewCap?: number;

  onConfirm: () => void;
}

export function BulkConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmDestructive = false,
  previewItems,
  totalAffected,
  previewCap = 12,
  onConfirm,
}: Readonly<BulkConfirmDialogProps>) {
  const shown = previewItems.slice(0, previewCap);
  const remaining = Math.max(0, totalAffected - shown.length);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          confirmDestructive && "border-red-200 dark:border-red-800",
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(
              confirmDestructive && "text-red-900 dark:text-red-100",
            )}
          >
            {title}
          </AlertDialogTitle>

          {description ? (
            <AlertDialogDescription className="text-muted-foreground">
              {description}
            </AlertDialogDescription>
          ) : null}

          <div className="
            mt-3 border border-gold/20 bg-gold/3 p-3
            dark:border-gold/15 dark:bg-gold/3
          ">
            <div className="text-xs font-medium text-foreground">
              Affected cards: {totalAffected}
            </div>

            {shown.length > 0 ? (
              <ul className="mt-2 max-h-44 space-y-1 overflow-auto pr-1">
                {shown.map((item) => (
                  <li
                    key={item.cardId}
                    className="
                      flex items-center justify-between gap-2 bg-background px-2 py-1 text-xs
                      text-foreground shadow-sm
                    "
                  >
                    <span className="min-w-0 truncate">
                      {item.label}
                      {item.group ? (
                        <span className="ml-2 text-muted-foreground">
                          ({item.group})
                        </span>
                      ) : null}
                    </span>

                    {typeof item.enabled === "boolean" ? (
                      <span
                        className={cn(
                          "shrink-0 px-1.5 py-0.5 text-[10px] font-medium",
                          item.enabled
                            ? "bg-gold/15 text-gold-dim dark:bg-gold/10 dark:text-gold"
                            : "bg-gold/5 text-muted-foreground",
                        )}
                      >
                        {item.enabled ? "Enabled" : "Disabled"}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                {totalAffected > 0
                  ? "No preview available."
                  : "No cards will be affected."}
              </div>
            )}

            {remaining > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                …and {remaining} more
              </div>
            ) : null}
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              confirmDestructive &&
                "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
