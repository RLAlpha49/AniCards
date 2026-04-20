/**
 * Color utility helpers.
 */
import type { ColorValue } from "@/lib/types/card";

/**
 * Normalize a ColorValue (or string/undefined) for comparison.
 * Returns a string representation when the value is present, or undefined when absent.
 *
 * This is used for legacy heuristics that compare gradients/strings by their serialized value.
 */
export function normalizeForCompare(
  value: ColorValue | string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}
