"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { safeTrack, trackSettingsChanged } from "@/lib/utils/google-analytics";

export default function DarkModeToggle() {
  const [bloomKey, setBloomKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = useCallback(() => {
    const newTheme = isDark ? "light" : "dark";
    setBloomKey((current) => current + 1);
    setTheme(newTheme);
    safeTrack(() => trackSettingsChanged(`theme_${newTheme}`));
  }, [isDark, setTheme]);

  if (!mounted) {
    return (
      <span
        aria-hidden
        className="
          group relative isolate flex size-11 items-center justify-center rounded-full border
          border-gold/40 bg-transparent transition-[border-color] duration-300 outline-none
          md:size-9
        "
      >
        <span
          aria-hidden
          className="size-[10px] rounded-full border border-gold/60 bg-gold/10"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleThemeToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      role="switch"
      aria-checked={isDark}
      className="
        group relative isolate flex size-11 cursor-pointer items-center justify-center rounded-full
        border border-gold/40 bg-transparent transition-[transform,border-color] duration-300
        outline-none
        hover:border-gold/80
        focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
        focus-visible:ring-offset-background
        motion-safe:hover:scale-[1.08]
        motion-safe:active:scale-[0.92]
        motion-reduce:transition-none
        md:size-9
      "
    >
      {/* Ambient gold glow — visible on hover */}
      <span
        aria-hidden
        className="
          pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity
          duration-300
          group-hover:opacity-100
          motion-reduce:transition-none
        "
        style={{
          boxShadow:
            "0 0 14px 2px hsl(var(--gold) / 0.25), inset 0 0 8px hsl(var(--gold) / 0.08)",
        }}
      />

      {/* Radial bloom on theme change */}
      {bloomKey > 0 && (
        <span
          key={bloomKey}
          aria-hidden
          className="
            pointer-events-none absolute inset-0 rounded-full
            motion-safe:animate-ping motion-safe:animation-duration-[600ms]
            motion-reduce:animate-none
          "
          style={{
            background: `radial-gradient(circle, hsl(var(--gold) / 0.3) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Icon crossfade with rotation */}
      <span className="relative size-[18px]" aria-hidden>
        <span
          className={cn(
            `
              absolute inset-0 flex items-center justify-center text-gold transition-all
              duration-150
              motion-reduce:transition-none
            `,
            isDark
              ? "scale-100 rotate-0 opacity-100"
              : "pointer-events-none scale-50 -rotate-90 opacity-0",
          )}
        >
          <Moon className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span
          className={cn(
            `
              absolute inset-0 flex items-center justify-center text-gold transition-all
              duration-150
              motion-reduce:transition-none
            `,
            isDark
              ? "pointer-events-none scale-50 rotate-90 opacity-0"
              : "scale-100 rotate-0 opacity-100",
          )}
        >
          <Sun className="size-[18px]" strokeWidth={1.75} />
        </span>
      </span>
    </button>
  );
}
