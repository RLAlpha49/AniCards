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

  mediaQueryList.addListener(listener);

  return () => {
    mediaQueryList.removeListener(listener);
  };
}

export function useMotionPreferences() {
  const runtimeReducedMotion = useReducedMotion() ?? false;
  const [hasHydrated, setHasHydrated] = useState(false);
  const [prefersReducedData, setPrefersReducedData] = useState(false);
  const [prefersCoarsePointer, setPrefersCoarsePointer] = useState(false);

  useEffect(() => {
    setHasHydrated(true);

    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const reducedDataQuery = window.matchMedia(REDUCED_DATA_MEDIA_QUERY);
    const coarsePointerQuery = window.matchMedia(COARSE_POINTER_MEDIA_QUERY);

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
