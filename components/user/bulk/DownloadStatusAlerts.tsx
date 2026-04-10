"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface DownloadSummary {
  requestedTotal: number;
  exported: number;
  failed: number;
  skippedDisabled: number;
  failedCardRawTypes?: string[];
  skippedDisabledCardRawTypes?: string[];
}

interface CreateDownloadSummaryArgs {
  requestedTotal: number;
  exported?: number;
  failed?: number;
  failedCardRawTypes?: string[];
  skippedDisabledCardRawTypes?: string[];
}

function formatSummaryList(items: readonly string[]): string {
  return `${items.slice(0, 5).join(", ")}${items.length > 5 ? ", ..." : ""}`;
}

export function createDownloadSummary(
  args: Readonly<CreateDownloadSummaryArgs>,
): DownloadSummary {
  const exported = Math.max(0, args.exported ?? 0);
  const failed = Math.max(0, args.failed ?? 0);
  const failedCardRawTypes = (args.failedCardRawTypes ?? []).filter(
    (value): value is string => value.trim().length > 0,
  );
  const skippedDisabledCardRawTypes = (
    args.skippedDisabledCardRawTypes ?? []
  ).filter((value): value is string => value.trim().length > 0);
  const skippedDisabled = skippedDisabledCardRawTypes.length;
  const requestedTotal = Math.max(
    0,
    args.requestedTotal,
    exported + failed + skippedDisabled,
  );

  return {
    requestedTotal,
    exported,
    failed,
    skippedDisabled,
    ...(failedCardRawTypes.length > 0 ? { failedCardRawTypes } : {}),
    ...(skippedDisabled > 0 ? { skippedDisabledCardRawTypes } : {}),
  };
}

export function getDownloadSummaryTitle(
  summary: Readonly<DownloadSummary>,
): string {
  if (summary.failed > 0) {
    const issueParts = [`${summary.failed} failed`];
    if (summary.skippedDisabled > 0) {
      issueParts.push(`${summary.skippedDisabled} skipped disabled`);
    }

    return `Exported ${summary.exported}/${summary.requestedTotal} selected (${issueParts.join(", ")})`;
  }

  if (summary.skippedDisabled > 0) {
    if (summary.exported > 0) {
      return `Exported ${summary.exported}/${summary.requestedTotal} selected (${summary.skippedDisabled} skipped disabled)`;
    }

    return `Skipped ${summary.skippedDisabled} disabled selected card${summary.skippedDisabled === 1 ? "" : "s"}`;
  }

  return `Exported ${summary.exported}/${summary.requestedTotal}`;
}

interface DownloadStatusAlertsProps {
  downloadSummary: DownloadSummary | null;
  downloadError: string | null;
  setDownloadSummary: React.Dispatch<
    React.SetStateAction<DownloadSummary | null>
  >;
  setDownloadError: React.Dispatch<React.SetStateAction<string | null>>;
  copyToClipboard: (list: string[]) => Promise<void> | void;
}

/**
 * Pure UI component that displays download success/errors. Parent owns state and copy helper.
 */
export function DownloadStatusAlerts({
  downloadSummary,
  downloadError,
  setDownloadSummary,
  setDownloadError,
  copyToClipboard,
}: Readonly<DownloadStatusAlertsProps>) {
  return (
    <AnimatePresence>
      {downloadError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: "auto" }}
          exit={{ opacity: 0, scale: 0.95, height: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full sm:w-auto"
        >
          <Alert
            variant="destructive"
            aria-live="assertive"
            className="border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
          >
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle className="text-red-800 dark:text-red-200">
              Download Error
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300">
              {downloadError}
            </AlertDescription>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDownloadError(null)}
              >
                Close
              </Button>
            </div>
          </Alert>
        </motion.div>
      )}

      {downloadSummary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: "auto" }}
          exit={{ opacity: 0, scale: 0.95, height: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full sm:w-auto"
        >
          <Alert
            variant={downloadSummary.failed > 0 ? "destructive" : "default"}
            aria-live={downloadSummary.failed > 0 ? "assertive" : "polite"}
            className={cn(
              downloadSummary.failed > 0
                ? "border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
                : "border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3",
              "mt-2 sm:mt-0",
            )}
          >
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle
              className={
                downloadSummary.failed > 0
                  ? "text-red-800 dark:text-red-200"
                  : "text-foreground"
              }
            >
              {getDownloadSummaryTitle(downloadSummary)}
            </AlertTitle>

            {(downloadSummary.failedCardRawTypes?.length ?? 0) > 0 ||
            (downloadSummary.skippedDisabledCardRawTypes?.length ?? 0) > 0 ? (
              <AlertDescription
                className={
                  downloadSummary.failed > 0
                    ? "text-red-700 dark:text-red-300"
                    : "text-muted-foreground"
                }
              >
                {downloadSummary.failedCardRawTypes?.length ? (
                  <p>
                    <span className="font-medium">Failed:</span>{" "}
                    {formatSummaryList(downloadSummary.failedCardRawTypes)}
                  </p>
                ) : null}

                {downloadSummary.skippedDisabledCardRawTypes?.length ? (
                  <p
                    className={
                      downloadSummary.failedCardRawTypes?.length
                        ? "mt-1"
                        : undefined
                    }
                  >
                    <span className="font-medium">Skipped disabled:</span>{" "}
                    {formatSummaryList(
                      downloadSummary.skippedDisabledCardRawTypes,
                    )}
                  </p>
                ) : null}
              </AlertDescription>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDownloadSummary(null)}
              >
                Close
              </Button>

              {downloadSummary.failed > 0 &&
                downloadSummary.failedCardRawTypes &&
                downloadSummary.failedCardRawTypes.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label="Copy failed card list"
                    onClick={() => {
                      const list = downloadSummary.failedCardRawTypes ?? [];
                      copyToClipboard(list);
                    }}
                  >
                    Copy list
                  </Button>
                )}
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
