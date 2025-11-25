"use client";

import { ThemeProvider } from "next-themes";
import type React from "react";

/**
 * Provides the next-themes provider to ensure consistent client-side theming.
 * @param children - Elements rendered inside the theme context.
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
      {children}
    </ThemeProvider>
  );
}
