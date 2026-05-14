// usePreviewColorPreset.ts
//
// Resolves the preview color preset only after the client theme is known.
// Returning `null` during the first render avoids guessing light or dark before
// `next-themes` hydrates, which keeps preview placeholders from mismatching the
// eventual themed card.

"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { resolvePreviewColorPreset } from "@/lib/preview-theme";

/**
 * Returns the preview preset for the resolved theme once the component has mounted.
 */
export function usePreviewColorPreset() {
  const { resolvedTheme } = useTheme();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return useMemo(() => {
    if (!hasMounted) {
      return null;
    }

    return resolvePreviewColorPreset(resolvedTheme);
  }, [hasMounted, resolvedTheme]);
}
