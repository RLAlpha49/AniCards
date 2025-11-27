import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  RotateCcw,
  Palette,
  User,
  CreditCard,
  Database,
  ChevronDown,
} from "lucide-react";

/**
 * Props for the ResetSettings component.
 * @property onReset - Callback that triggers a full application settings reset.
 * @source
 */
interface ResetSettingsProps {
  onReset: () => void;
}

/**
 * List of items that will be reset.
 * @source
 */
const RESET_ITEMS = [
  { icon: Palette, text: "Theme preferences", color: "text-purple-500" },
  { icon: User, text: "Default username", color: "text-pink-500" },
  {
    icon: CreditCard,
    text: "Default card settings and presets",
    color: "text-blue-500",
  },
  { icon: Database, text: "All cached data", color: "text-orange-500" },
];

/**
 * Renders UI to confirm and trigger a full reset of the application settings.
 * Displays which settings will be reset and a destructive button to apply the reset.
 * @param onReset - Callback invoked to perform the reset action.
 * @returns A React element rendering the reset confirmation UI.
 * @source
 */
export function ResetSettings({ onReset }: Readonly<ResetSettingsProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    if (confirmReset) {
      onReset();
      setConfirmReset(false);
      setIsExpanded(false);
    } else {
      setConfirmReset(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-red-200/50 bg-gradient-to-br from-red-50/80 via-rose-50/60 to-orange-50/80 shadow-xl shadow-red-200/30 backdrop-blur-xl dark:border-red-900/30 dark:from-red-950/30 dark:via-rose-950/20 dark:to-orange-950/30 dark:shadow-red-900/20">
        {/* Header - Clickable to expand */}
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
            if (!isExpanded) setConfirmReset(false);
          }}
          className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-red-100/30 dark:hover:bg-red-900/10"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-red-500 via-rose-500 to-orange-500 p-3.5 shadow-lg shadow-red-500/25">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-900 dark:text-red-200">
                Reset All Settings
              </h3>
              <p className="text-sm text-red-700/70 dark:text-red-300/70">
                Restore application to default state
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-full bg-red-100 p-2 dark:bg-red-900/30"
          >
            <ChevronDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          </motion.div>
        </button>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-red-200/50 p-6 dark:border-red-900/30">
                {/* Warning Box */}
                <div className="mb-6 rounded-2xl border border-red-200/50 bg-white/60 p-5 dark:border-red-900/30 dark:bg-red-950/20">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-red-100 p-2 dark:bg-red-900/50">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        This action will reset:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {RESET_ITEMS.map((item, index) => (
                      <motion.div
                        key={item.text}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 rounded-xl bg-red-50/50 px-4 py-3 dark:bg-red-900/20"
                      >
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                          {item.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Reset Button */}
                <div className="space-y-3">
                  <Button
                    variant="destructive"
                    onClick={handleReset}
                    className={`group h-14 w-full rounded-xl font-semibold shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl ${
                      confirmReset
                        ? "animate-pulse bg-gradient-to-r from-red-600 via-rose-600 to-red-600 shadow-red-600/30 hover:shadow-red-600/40"
                        : "bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 shadow-red-500/25 hover:shadow-red-500/35"
                    }`}
                    aria-label="Reset all application settings to their default values"
                  >
                    <RotateCcw
                      className={`mr-2 h-5 w-5 transition-transform ${confirmReset ? "animate-spin" : "group-hover:-rotate-180"}`}
                    />
                    {confirmReset
                      ? "Click Again to Confirm Reset"
                      : "Reset to Default Settings"}
                  </Button>

                  <p className="text-center text-xs font-medium text-red-600/80 dark:text-red-400/80">
                    {confirmReset
                      ? "⚠️ Are you sure? This action cannot be undone."
                      : "Your settings will be permanently reset to defaults."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
