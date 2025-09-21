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
}: Readonly<SidebarBehaviorProps>) {
  const handleSidebarChange = (checked: boolean) => {
    trackSettingsChanged(
      `sidebar_default_${checked ? "expanded" : "collapsed"}`,
    );
    onSidebarChange(checked);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-700/20">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-r from-green-500 to-blue-500 p-2">
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
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          </div>
          <div>
            <Label className="text-xl font-semibold text-gray-900 dark:text-white">
              Sidebar Behavior
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Configure how the sidebar appears when you load the page
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm dark:border-gray-600/20 dark:bg-gray-600/20">
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">
              Default State
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sidebar will be{" "}
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {sidebarDefault ? "expanded" : "collapsed"}
              </span>{" "}
              when you open the app
            </p>
          </div>
          <Switch
            checked={sidebarDefault}
            onCheckedChange={handleSidebarChange}
            className="transition-all duration-200 data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600"
          />
        </div>
      </div>
    </motion.div>
  );
}
