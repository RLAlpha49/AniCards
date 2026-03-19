"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { safeTrack, trackSettingsChanged } from "@/lib/utils/google-analytics";

/**
 * Interactive toggle to switch between light and dark themes.
 * - Uses `next-themes` to toggle between 'dark' and 'light', honoring 'system'.
 * - Tracks setting changes using the analytics helper.
 * - Uses a mount check to avoid SSR hydration mismatch.
 * @returns A button element representing the theme switch.
 * @source
 */
export default function DarkModeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = useCallback(() => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    safeTrack(() => trackSettingsChanged(`theme_${newTheme}`));
  }, [currentTheme, setTheme]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleThemeToggle();
    }
  };

  if (!mounted) return null;

  const sunAnimate =
    currentTheme === "dark"
      ? { opacity: 0.6, scale: 0.9, rotate: -90 }
      : { opacity: 1, scale: 1, rotate: 0 };
  const moonAnimate =
    currentTheme === "dark"
      ? { opacity: 1, scale: 1, rotate: 0 }
      : { opacity: 0.6, scale: 0.9, rotate: 90 };
  const thumbX = currentTheme === "dark" ? 26 : -2;

  return (
    <button
      type="button"
      onClick={handleThemeToggle}
      onKeyDown={onKeyDown}
      aria-label={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
      role="switch"
      aria-checked={currentTheme === "dark"}
      className="focus-visible:ring-primary relative inline-flex h-7 w-14 items-center rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: currentTheme === "dark" ? "#e8dcc8" : "#d4c9a8",
      }}
    >
      <motion.span
        className="absolute left-1 flex items-center justify-center"
        aria-hidden
        initial={false}
        animate={sunAnimate}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ color: "#8B7A3E" }}
      >
        <Sun className="h-5 w-5" strokeWidth={2.5} />
      </motion.span>

      <motion.span
        className="absolute right-1 flex items-center justify-center text-gray-800 dark:text-gray-100"
        aria-hidden
        initial={false}
        animate={moonAnimate}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Moon className="h-5 w-5" />
      </motion.span>

      <motion.span
        className="absolute h-6 w-6 rounded-full bg-white shadow-md"
        initial={false}
        animate={{ x: thumbX }}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        style={{
          backgroundColor: currentTheme === "dark" ? "#0C0A10" : "#fff",
        }}
      />
    </button>
  );
}
