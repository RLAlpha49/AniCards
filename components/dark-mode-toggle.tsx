"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { trackSettingsChanged } from "@/lib/utils/google-analytics";

/**
 * Interactive toggle to switch between light and dark themes.
 * - Uses `next-themes` to toggle between 'dark' and 'light', honoring 'system'.
 * - Tracks setting changes using the analytics helper.
 * - Uses a mount check to avoid SSR hydration mismatch.
 * @returns A button element representing the theme switch.
 * @source
 */
export default function DarkModeToggle() {
  // Prevent hydration mismatch by checking whether this is running client-side.
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  // Use resolvedTheme when the theme is 'system' so the UI reflects the OS setting.
  const currentTheme = theme === "system" ? resolvedTheme : theme;

  useEffect(() => {
    setMounted(true); // Component has mounted (client-side)
  }, []);

  const handleThemeToggle = useCallback(() => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    trackSettingsChanged(`theme_${newTheme}`);
    setTheme(newTheme);
  }, [currentTheme, setTheme]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleThemeToggle();
    }
  };

  if (!mounted) return null; // Don't render until mounted

  const sunAnimate: Record<string, number> | {} =
    currentTheme === "dark"
      ? { opacity: 0.6, scale: 0.9 }
      : { opacity: 1, scale: 1 };
  const moonAnimate: Record<string, number> | {} =
    currentTheme === "dark"
      ? { opacity: 1, scale: 1 }
      : { opacity: 0.6, scale: 0.9 };
  const thumbX = currentTheme === "dark" ? 26 : -2;

  return (
    <button
      type="button"
      onClick={handleThemeToggle}
      onKeyDown={onKeyDown}
      aria-label={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
      role="switch"
      aria-checked={currentTheme === "dark"}
      className="relative inline-flex h-7 w-14 items-center rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={{
        backgroundColor: currentTheme === "dark" ? "#e7e7e7" : "#D1D5DB",
      }}
    >
      {/* Sun (left) */}
      <motion.span
        className="absolute left-1 flex items-center justify-center"
        aria-hidden
        initial={false}
        animate={sunAnimate}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ color: "#917b0a" }}
      >
        <Sun className="h-5 w-5" strokeWidth={2.5} />
      </motion.span>

      {/* Moon (right) */}
      <motion.span
        className="absolute right-1 flex items-center justify-center text-gray-800 dark:text-gray-100"
        aria-hidden
        initial={false}
        animate={moonAnimate}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Moon className="h-5 w-5" />
      </motion.span>

      {/* Thumb */}
      <motion.span
        className="absolute h-6 w-6 rounded-full bg-white shadow-md"
        initial={false}
        animate={{ x: thumbX }}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        style={{
          backgroundColor: currentTheme === "dark" ? "#040a1b" : "#fff",
        }}
      />
    </button>
  );
}
