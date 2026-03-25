"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { resolvePreviewColorPreset } from "@/lib/preview-theme";

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
