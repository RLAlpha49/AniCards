import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * Presentational alert describing how to force-refresh or clear cached SVGs.
 * Useful for debugging when the generated graphic does not update immediately.
 * @returns An Alert element that outlines refresh instructions.
 * @source
 */
export function UpdateNotice() {
  return (
    <Alert className="border-blue-100 bg-blue-50/50 backdrop-blur-sm dark:border-blue-900/30 dark:bg-blue-900/10">
      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      <div className="ml-3">
        <AlertTitle className="text-base font-semibold text-blue-700 dark:text-blue-300">
          Update Notice
        </AlertTitle>
        <AlertDescription className="text-sm text-blue-600/90 dark:text-blue-400/90">
          <div className="mt-2 space-y-3">
            <p>
              SVGs are cached for 24 hours. If your changes don&apos;t appear:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  1
                </span>
                <span>Hard refresh with</span>
                <div className="flex items-center gap-1">
                  <kbd className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    Ctrl
                  </kbd>
                  <span>+</span>
                  <kbd className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    F5
                  </kbd>
                </div>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  2
                </span>
                <span>Or on Mac:</span>
                <div className="flex items-center gap-1">
                  <kbd className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    Cmd
                  </kbd>
                  <span>+</span>
                  <kbd className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    Shift
                  </kbd>
                  <span>+</span>
                  <kbd className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    R
                  </kbd>
                </div>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  3
                </span>
                <span>Clear browser cache or wait 24h</span>
              </li>
            </ul>
          </div>
        </AlertDescription>
      </div>
    </Alert>
  );
}
