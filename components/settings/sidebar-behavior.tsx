import React from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { trackSettingsChanged } from "@/lib/utils/google-analytics";
import { PanelLeftClose, PanelLeft, LayoutPanelLeft } from "lucide-react";

/**
 * Props for SidebarBehavior component.
 * @property sidebarDefault - Whether the sidebar should be expanded by default.
 * @property onSidebarChange - Callback invoked when the sidebar default changes.
 * @source
 */
interface SidebarBehaviorProps {
  sidebarDefault: boolean;
  onSidebarChange: (checked: boolean) => void;
}

/**
 * Renders UI to configure the sidebar's default behavior on page load.
 * Tracks changes via analytics and forwards updated values via callback.
 * @param sidebarDefault - Current default open state of the sidebar.
 * @param onSidebarChange - Handler to update the default state.
 * @returns A React element representing the sidebar behavior settings.
 * @source
 */
export function SidebarBehavior({
  sidebarDefault,
  onSidebarChange,
}: Readonly<SidebarBehaviorProps>) {
  /**
   * Handle toggling sidebar default state and report via analytics.
   * @param checked - New default sidebar expanded state.
   * @source
   */
  const handleSidebarChange = (checked: boolean) => {
    trackSettingsChanged(
      `sidebar_default_${checked ? "expanded" : "collapsed"}`,
    );
    onSidebarChange(checked);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50">
        {/* Header */}
        <div className="border-b border-slate-200/50 bg-white/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 p-3.5 shadow-lg shadow-green-500/25">
              <LayoutPanelLeft className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Sidebar Behavior
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure how the sidebar appears when you load the page
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-white/60 p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/60"
          >
            <div className="flex items-center gap-4">
              <div
                className={`rounded-xl p-3 transition-all ${
                  sidebarDefault
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {sidebarDefault ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Default State
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Sidebar will be{" "}
                  <span
                    className={`font-semibold ${
                      sidebarDefault
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {sidebarDefault ? "expanded" : "collapsed"}
                  </span>{" "}
                  when you open the app
                </p>
              </div>
            </div>
            <Switch
              checked={sidebarDefault}
              onCheckedChange={handleSidebarChange}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500"
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
