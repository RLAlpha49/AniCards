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
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {description}
            </AlertDialogDescription>
          ) : null}

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Affected cards: {totalAffected}
            </div>

            {shown.length > 0 ? (
              <ul className="mt-2 max-h-44 space-y-1 overflow-auto pr-1">
                {shown.map((item) => (
                  <li
                    key={item.cardId}
                    className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-xs text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span className="min-w-0 truncate">
                      {item.label}
                      {item.group ? (
                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                          ({item.group})
                        </span>
                      ) : null}
                    </span>

                    {typeof item.enabled === "boolean" ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                          item.enabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
                        )}
                      >
                        {item.enabled ? "Enabled" : "Disabled"}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                No cards will be affected.
              </div>
            )}

            {remaining > 0 ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
