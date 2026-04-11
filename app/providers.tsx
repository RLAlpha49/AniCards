"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode, useEffect } from "react";

import { Toaster } from "@/components/ui/Toaster";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { flushClientErrorReportBacklog } from "@/lib/error-tracking";

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
  nonce,
}: Readonly<{ children: ReactNode; nonce?: string }>) {
  useEffect(() => {
    void flushClientErrorReportBacklog();

    const handleOnline = () => {
      void flushClientErrorReportBacklog();
    };

    globalThis.window.addEventListener("online", handleOnline);

    return () => {
      globalThis.window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableColorScheme
      nonce={nonce}
    >
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
