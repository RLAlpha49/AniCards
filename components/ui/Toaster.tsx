"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Global toast renderer (Sonner).
 *
 * Mount once near the root of the app (e.g., in `app/providers.tsx`).
 *
 * @source
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      richColors
      expand
    />
  );
}
