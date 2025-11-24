import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
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

        <div className="grid grid-cols-3 gap-4">
          {themes.map((t) => {
            const isActive = theme === t;
            let gradientClass = "bg-gradient-to-br from-blue-400 to-purple-500";
            if (t === "light") {
              gradientClass = "bg-gradient-to-br from-yellow-300 to-orange-400";
            } else if (t === "dark") {
              gradientClass = "bg-gradient-to-br from-slate-700 to-slate-900";
            }

            return (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:scale-[1.02] ${
                  isActive
                    ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20"
                    : "border-slate-200 bg-slate-50/50 hover:border-blue-200 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-800 dark:hover:bg-blue-900/10"
                }`}
              >
                <div
                  className={`h-12 w-12 rounded-full shadow-lg transition-transform group-hover:scale-110 ${gradientClass}`}
                >
                  {t === "light" && (
                    <svg
                      className="h-full w-full p-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  )}
                  {t === "dark" && (
                    <svg
                      className="h-full w-full p-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  )}
                  {t === "system" && (
                    <svg
                      className="h-full w-full p-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`font-medium capitalize ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {t}
                </span>
                {isActive && (
                  <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
