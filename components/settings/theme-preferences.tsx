import React from "react";
import { motion } from "framer-motion";
import { trackSettingsChanged, safeTrack } from "@/lib/utils/google-analytics";
import { Palette, Sun, Moon, Monitor } from "lucide-react";

/**
 * Props for ThemePreferences component.
 * @property theme - Currently selected theme id.
 * @property themes - Array of available theme ids.
 * @property onThemeChange - Callback invoked when the user selects a new theme.
 * @source
 */
interface ThemePreferencesProps {
  theme: string;
  themes: string[];
  onThemeChange: (value: string) => void;
}

/**
 * Icon mapping for theme options.
 * @source
 */
const THEME_ICONS: Record<string, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * Theme metadata for display purposes.
 * @source
 */
const THEME_META: Record<
  string,
  { gradient: string; description: string; bgPreview: string }
> = {
  light: {
    gradient: "from-amber-400 to-orange-500",
    description: "Bright and clean",
    bgPreview:
      "bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-yellow-900/30",
  },
  dark: {
    gradient: "from-slate-600 to-slate-800",
    description: "Easy on the eyes",
    bgPreview:
      "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 dark:from-slate-600 dark:via-slate-700 dark:to-slate-800",
  },
  system: {
    gradient: "from-blue-500 to-purple-600",
    description: "Match your device",
    bgPreview:
      "bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 dark:from-blue-900/30 dark:via-purple-900/20 dark:to-pink-900/30",
  },
};

/**
 * Renders the theme selection UI for the application.
 * Presents visual tiles for each theme and forwards the selection via callback.
 * @param theme - Current active theme id.
 * @param themes - List of available theme ids.
 * @param onThemeChange - Handler called with a new theme id when selected.
 * @returns A React element rendering the theme preferences UI.
 * @source
 */
export function ThemePreferences({
  theme,
  themes,
  onThemeChange,
}: Readonly<ThemePreferencesProps>) {
  /**
   * Track selection of a theme and call parent handler with selected value.
   * @param value - The selected theme id.
   * @source
   */
  const handleThemeChange = (value: string) => {
    onThemeChange(value);
    safeTrack(() => trackSettingsChanged(`theme-${value}`));
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
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-3.5 shadow-lg shadow-purple-500/25">
              <Palette className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Theme Preferences
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose your preferred color theme for the application
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {themes.map((t) => {
              const isActive = theme === t;
              const Icon = THEME_ICONS[t] || Monitor;
              const meta = THEME_META[t] || THEME_META.system;

              return (
                <motion.button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative flex flex-col items-center overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 ${
                    isActive
                      ? "border-blue-500 bg-blue-50/80 shadow-lg shadow-blue-500/20 dark:border-blue-400 dark:bg-blue-900/30"
                      : "border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  }`}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTheme"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}

                  {/* Icon container */}
                  <div
                    className={`relative mb-4 rounded-2xl p-4 transition-all duration-300 ${meta.bgPreview} ${
                      isActive
                        ? "shadow-lg"
                        : "group-hover:shadow-md dark:group-hover:shadow-slate-900/50"
                    }`}
                  >
                    <div
                      className={`rounded-xl bg-gradient-to-br ${meta.gradient} p-3 shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  {/* Label */}
                  <span
                    className={`relative text-lg font-semibold capitalize transition-colors ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {t}
                  </span>

                  {/* Description */}
                  <span className="relative mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {meta.description}
                  </span>

                  {/* Checkmark badge */}
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30"
                    >
                      <svg
                        className="h-3.5 w-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
