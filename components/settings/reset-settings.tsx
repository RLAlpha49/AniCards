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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
      className="space-y-4"
    >
      <Label className="text-lg font-medium">Reset Settings</Label>
      <div className="flex flex-col space-y-2 rounded-lg bg-accent/40 p-4">
        <Button
          variant="destructive"
          onClick={onReset}
          aria-label="Reset all application settings to their default values"
        >
          Reset to Default Settings
        </Button>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          This will reset all settings.
        </p>
      </div>
    </motion.div>
  );
}
