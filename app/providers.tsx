"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type React from "react";

/**
 * Provides the next-themes provider to ensure consistent client-side theming.
 *
 * `nonce` is forwarded to the inline theme script next-themes writes before
 * paint. An enforcing CSP blocks that script without it, which leaves the page
 * on the wrong theme for a frame.
 *
 * @param children - Elements rendered inside the theme context.
 * @param nonce - CSP nonce for the inline theme script.
 * @source
 */
export function Providers({
  children,
  nonce,
}: Readonly<{ children: React.ReactNode; nonce?: string }>) {
  return (
    <ThemeProvider
      attribute="class" // Use CSS class-based theming (dark/light classes)
      defaultTheme="system" // Default to OS preference
      nonce={nonce}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
