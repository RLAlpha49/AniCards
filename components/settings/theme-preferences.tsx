import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trackSettingsChanged } from "@/lib/utils/google-analytics";

interface ThemePreferencesProps {
  theme: string;
  themes: string[];
  onThemeChange: (value: string) => void;
}

export function ThemePreferences({
  theme,
  themes,
  onThemeChange,
}: Readonly<ThemePreferencesProps>) {
  const handleThemeChange = (value: string) => {
    trackSettingsChanged(`theme-${value}`);
    onThemeChange(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-3 shadow-lg shadow-blue-500/20">
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
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a2 2 0 002 2h4a2 2 0 002-2V5zM21 15a2 2 0 00-2-2h-4a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2z"
              />
            </svg>
          </div>
          <div>
            <Label className="text-xl font-bold text-slate-900 dark:text-white">
              Theme Preferences
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Choose your preferred color theme for the application
            </p>
          </div>
        </div>

        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className="h-12 w-full max-w-sm border-slate-200 bg-white px-4 text-base transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:focus:border-blue-400">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
            {themes.map((t) => {
              let themeDotClass = "";
              if (t === "light") {
                themeDotClass =
                  "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]";
              } else if (t === "dark") {
                themeDotClass =
                  "bg-slate-800 shadow-[0_0_10px_rgba(30,41,59,0.5)] border border-slate-600";
              } else {
                themeDotClass =
                  "bg-gradient-to-r from-yellow-400 to-slate-800 shadow-[0_0_10px_rgba(99,102,241,0.5)]";
              }
              return (
                <SelectItem
                  key={t}
                  value={t}
                  className="cursor-pointer py-3 transition-colors focus:bg-blue-50 dark:focus:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-4 w-4 rounded-full ${themeDotClass}`} />
                    <span className="font-medium">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </motion.div>
  );
}
