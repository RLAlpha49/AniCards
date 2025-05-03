"use client";

import { ThemeProvider } from "next-themes";
import type React from "react";

// Wrapper component for theme management using next-themes
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class" // Use CSS class-based theming (dark/light classes)
      defaultTheme="system" // Default to OS preference
    >
      {children}
    </ThemeProvider>
  );
}
