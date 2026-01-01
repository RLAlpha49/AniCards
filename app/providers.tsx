"use client";

import { ThemeProvider } from "next-themes";
import type React from "react";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { Toaster } from "@/components/ui/Toaster";

/**
 * Provides common app-level providers used throughout the app.
 *
 * - `ThemeProvider` for managing color scheme
 * - `TooltipProvider` so a single provider instance is shared across the app
 *   (avoid creating many provider instances inside repeated components like cards)
 *
 * @param children - Elements rendered inside the provider tree.
 * @source
 */
export function Providers({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class" // Use CSS class-based theming (dark/light classes)
      defaultTheme="system" // Default to OS preference
    >
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
