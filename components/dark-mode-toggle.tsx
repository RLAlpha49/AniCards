"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { trackSettingsChanged } from "@/lib/utils/google-analytics";

export default function DarkModeToggle() {
  // Prevent hydration mismatch by checking mount state
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  // Use resolvedTheme if theme is set to "system"
  const currentTheme = theme === "system" ? resolvedTheme : theme;

  useEffect(() => {
    setMounted(true); // Component has mounted (client-side)
  }, []);

  const handleThemeToggle = () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    trackSettingsChanged(`theme_${newTheme}`);
    setTheme(newTheme);
  };

  if (!mounted) return null; // Don't render until mounted

  return (
    <motion.button
      className="relative flex h-7 w-14 items-center justify-between rounded-full bg-gray-300 p-1"
      onClick={handleThemeToggle}
      animate={{
        backgroundColor: currentTheme === "dark" ? "#4B5563" : "#D1D5DB",
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Sun and Moon icons positioned absolutely */}
      <Sun className="h-5 w-5 text-yellow-500" />
      <Moon className="h-5 w-5 text-gray-800" />

      {/* Animated toggle thumb */}
      <motion.div
        className="absolute h-5 w-5 rounded-full bg-white shadow-md"
        animate={{
          x: currentTheme === "dark" ? 26 : 2, // Slide position based on theme
        }}
        transition={{
          type: "spring", // Bouncy animation
          stiffness: 700, // Spring tension
          damping: 30, // Spring friction
        }}
      />
    </motion.button>
  );
}
