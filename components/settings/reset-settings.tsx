import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ResetSettingsProps {
  onReset: () => void;
}

export function ResetSettings({ onReset }: Readonly<ResetSettingsProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-red-200/50 bg-red-50/50 p-6 backdrop-blur-sm dark:border-red-800/30 dark:bg-red-900/20">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-r from-red-500 to-orange-500 p-2">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <Label className="text-xl font-semibold text-red-800 dark:text-red-300">
              Reset Settings
            </Label>
            <p className="text-sm text-red-700 dark:text-red-400">
              Reset all application settings to their default values
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-red-200/30 bg-red-50/30 p-4 backdrop-blur-sm dark:border-red-700/30 dark:bg-red-800/20">
            <div className="mb-3 flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="mb-1 font-medium">This action will reset:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Theme preferences</li>
                  <li>• Sidebar behavior settings</li>
                  <li>• Default username</li>
                  <li>• Default card settings and presets</li>
                  <li>• All cached data</li>
                </ul>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={onReset}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-200 hover:from-red-600 hover:to-red-700 hover:shadow-lg"
              aria-label="Reset all application settings to their default values"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset to Default Settings
            </Button>
          </div>

          <p className="text-center text-xs text-red-600 dark:text-red-400">
            This action cannot be undone. Your settings will be permanently
            reset.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
