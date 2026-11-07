"use client";

import { useEffect, useState } from "react";

const DEFAULT_DEBOUNCE_DELAY_MS = 300;

/**
 * Returns the latest value after it has stayed unchanged for the delay.
 * @source
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs = DEFAULT_DEBOUNCE_DELAY_MS,
): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
