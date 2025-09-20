import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function UpdateNotice() {
  return (
    <Alert className="border-blue-200/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-blue-800/50 dark:from-blue-900/40 dark:to-indigo-900/40">
      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      <div className="ml-3">
        <AlertTitle className="text-lg font-semibold text-blue-700 dark:text-blue-300">
          💡 Update Notice
        </AlertTitle>
        <AlertDescription className="text-gray-700 dark:text-gray-300">
          <div className="mt-2 space-y-3">
            <p className="font-medium">
              SVGs are cached for 24 hours. If your changes don&apos;t appear:
            </p>
            <ul className="list-disc space-y-1 pl-6 text-sm">
              <li className="flex items-center gap-2">
                <span>🔄 Hard refresh with</span>
                <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                  F5
                </kbd>
                <span className="text-gray-500">(Windows)</span>
              </li>
              <li className="flex items-center gap-2">
                <span>🍎 Or</span>
                <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                  Cmd
                </kbd>
                <span>+</span>
                <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                  Shift
                </kbd>
                <span>+</span>
                <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                  R
                </kbd>
                <span className="text-gray-500">(Mac)</span>
              </li>
              <li>🗑️ Clear browser cache</li>
              <li>⏰ Wait up to 24 hours for cache expiration</li>
            </ul>
          </div>
        </AlertDescription>
      </div>
    </Alert>
  );
}
