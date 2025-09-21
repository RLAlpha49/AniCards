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
      <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-700/20">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-2">
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
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a2 2 0 002 2h4a2 2 0 002-2V5zM21 15a2 2 0 00-2-2h-4a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2z"
              />
            </svg>
          </div>
          <div>
            <Label className="text-xl font-semibold text-gray-900 dark:text-white">
              Theme Preferences
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Choose your preferred color theme for the application
            </p>
          </div>
        </div>

        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-full max-w-sm border-white/20 bg-white/20 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/25 dark:border-gray-600/30 dark:bg-gray-700/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent className="border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
            {themes.map((t) => {
              let themeDotClass = "";
              if (t === "light") {
                themeDotClass = "bg-yellow-400";
              } else if (t === "dark") {
                themeDotClass = "bg-gray-800";
              } else {
                themeDotClass = "bg-gradient-to-r from-yellow-400 to-gray-800";
              }
              return (
                <SelectItem
                  key={t}
                  value={t}
                  className="transition-colors hover:bg-blue-100/50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${themeDotClass}`} />
                    {t.charAt(0).toUpperCase() + t.slice(1)}
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
