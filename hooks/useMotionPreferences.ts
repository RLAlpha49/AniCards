"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
  COARSE_POINTER_MEDIA_QUERY,
  REDUCED_DATA_MEDIA_QUERY,
  shouldSimplifyMotion,
} from "@/lib/animations";

function subscribeToMediaQuery(
  mediaQueryList: MediaQueryList,
  listener: () => void,
) {
  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", listener);

    return () => {
      mediaQueryList.removeEventListener("change", listener);
    };
  }

  const previousOnChange = mediaQueryList.onchange;
  const handleChange: NonNullable<MediaQueryList["onchange"]> = () => {
    listener();
  };

  mediaQueryList.onchange = handleChange;

  return () => {
    if (mediaQueryList.onchange === handleChange) {
      mediaQueryList.onchange = previousOnChange ?? null;
    }
  };
}

export function useMotionPreferences() {
  const runtimeReducedMotion = useReducedMotion() ?? false;
  const [hasHydrated, setHasHydrated] = useState(false);
  const [prefersReducedData, setPrefersReducedData] = useState(false);
  const [prefersCoarsePointer, setPrefersCoarsePointer] = useState(false);

  useEffect(() => {
    setHasHydrated(true);

    const windowObject = globalThis.window;

    if (windowObject === undefined || windowObject.matchMedia === undefined) {
      return;
    }

    const reducedDataQuery = windowObject.matchMedia(REDUCED_DATA_MEDIA_QUERY);
    const coarsePointerQuery = windowObject.matchMedia(
      COARSE_POINTER_MEDIA_QUERY,
    );

    const syncPreferences = () => {
      setPrefersReducedData(reducedDataQuery.matches);
      setPrefersCoarsePointer(coarsePointerQuery.matches);
    };

    syncPreferences();

    const unsubscribeReducedData = subscribeToMediaQuery(
      reducedDataQuery,
      syncPreferences,
    );
    const unsubscribeCoarsePointer = subscribeToMediaQuery(
      coarsePointerQuery,
      syncPreferences,
    );

    return () => {
      unsubscribeReducedData();
      unsubscribeCoarsePointer();
    };
  }, []);

  const prefersReducedMotion = hasHydrated ? runtimeReducedMotion : false;
  const prefersSimplifiedMotion = useMemo(
    () =>
      hasHydrated &&
      shouldSimplifyMotion({
        reducedMotion: runtimeReducedMotion,
        reducedData: prefersReducedData,
        coarsePointer: prefersCoarsePointer,
      }),
    [
      hasHydrated,
      prefersCoarsePointer,
      prefersReducedData,
      runtimeReducedMotion,
    ],
  );

  return {
    prefersReducedMotion,
    prefersReducedData,
    prefersCoarsePointer,
    prefersSimplifiedMotion,
  } as const;
}
