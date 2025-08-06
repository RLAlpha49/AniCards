import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trackSettingsChanged } from "@/lib/utils/google-analytics";

interface SidebarBehaviorProps {
  sidebarDefault: boolean;
  onSidebarChange: (checked: boolean) => void;
}

export function SidebarBehavior({
  sidebarDefault,
  onSidebarChange,
}: SidebarBehaviorProps) {
  const handleSidebarChange = (checked: boolean) => {
    trackSettingsChanged(
      `sidebar_default_${checked ? "expanded" : "collapsed"}`,
    );
    onSidebarChange(checked);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-4"
    >
      <Label className="text-lg font-medium">Sidebar Behavior</Label>
      <div className="flex items-center justify-between rounded-lg bg-accent/40 p-4">
        <div>
          <p className="font-medium">Default State</p>
          <p className="text-sm text-muted-foreground">
            {sidebarDefault ? "Expanded" : "Collapsed"} by default
          </p>
        </div>
        <Switch
          checked={sidebarDefault}
          onCheckedChange={handleSidebarChange}
          className="transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
        />
      </div>
    </motion.div>
  );
}
