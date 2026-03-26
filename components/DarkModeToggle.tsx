"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { safeTrack, trackSettingsChanged } from "@/lib/utils/google-analytics";

const ICON_TRANSITION = { duration: 0.16, ease: [0.16, 1, 0.3, 1] } as const;
const RING_TRANSITION = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const;

export default function DarkModeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = useCallback(() => {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);
    safeTrack(() => trackSettingsChanged(`theme_${newTheme}`));
  }, [isDark, setTheme]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleThemeToggle();
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle color mode"
        disabled
        className="
          group relative isolate flex size-11 cursor-default items-center justify-center
          rounded-full border border-gold/40 bg-transparent transition-[border-color] duration-300
          outline-none
          md:size-9
        "
      >
        <span
          aria-hidden
          className="size-[10px] rounded-full border border-gold/60 bg-gold/10"
        />
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={handleThemeToggle}
      onKeyDown={onKeyDown}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      role="switch"
      aria-checked={isDark}
      className="
        group relative isolate flex size-11 cursor-pointer items-center justify-center rounded-full
        border border-gold/40 bg-transparent transition-[border-color] duration-300 outline-none
        hover:border-gold/80
        focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
        focus-visible:ring-offset-background
        md:size-9
      "
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={RING_TRANSITION}
    >
      {/* Ambient gold glow — visible on hover */}
      <motion.span
        aria-hidden
        className="
          pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity
          duration-300
          group-hover:opacity-100
        "
        style={{
          boxShadow:
            "0 0 14px 2px hsl(var(--gold) / 0.25), inset 0 0 8px hsl(var(--gold) / 0.08)",
        }}
      />

      {/* Radial bloom on theme change */}
      <AnimatePresence mode="wait">
        <motion.span
          key={isDark ? "bloom-dark" : "bloom-light"}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            background: `radial-gradient(circle, hsl(var(--gold) / 0.3) 0%, transparent 70%)`,
          }}
        />
      </AnimatePresence>

      {/* Icon crossfade with rotation */}
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            className="flex items-center justify-center text-gold"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={ICON_TRANSITION}
          >
            <Moon className="size-[18px]" strokeWidth={1.75} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            className="flex items-center justify-center text-gold"
            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
            transition={ICON_TRANSITION}
          >
            <Sun className="size-[18px]" strokeWidth={1.75} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
