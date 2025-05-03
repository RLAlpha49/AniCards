import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ResetSettingsProps {
  onReset: () => void;
}

export function ResetSettings({ onReset }: ResetSettingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
      className="space-y-4"
    >
      <Label className="text-lg font-medium">Reset Settings</Label>
      <div className="flex flex-col space-y-2 rounded-lg bg-accent/40 p-4">
        <Button variant="destructive" onClick={onReset}>
          Reset to Default Settings
        </Button>
        <p className="text-xs text-muted-foreground">
          This will reset all settings.
        </p>
      </div>
    </motion.div>
  );
}
