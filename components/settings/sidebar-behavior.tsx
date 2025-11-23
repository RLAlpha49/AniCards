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
      <div className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3 shadow-lg shadow-green-500/20">
            <svg
              className="h-6 w-6 text-white"
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
            <Label className="text-xl font-bold text-slate-900 dark:text-white">
              Sidebar Behavior
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure how the sidebar appears when you load the page
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 backdrop-blur-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800">
          <div className="flex-1 pr-4">
            <p className="font-semibold text-slate-900 dark:text-white">
              Default State
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sidebar will be{" "}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {sidebarDefault ? "expanded" : "collapsed"}
              </span>{" "}
              when you open the app
            </p>
          </div>
          <Switch
            checked={sidebarDefault}
            onCheckedChange={handleSidebarChange}
            className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
          />
        </div>
      </div>
    </motion.div>
  );
}
