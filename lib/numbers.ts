/**
 * Numeric coercion and byte formatting.
 * @source
 */
/**
 * Safely coerce an unknown value into a finite number.
 * Returns a finite number when the input is a number or a numeric string,
 * otherwise returns the provided fallback (default: null). In non-production
 * environments, an informative warning will be logged to make it easier to
 * detect malformed server data during development and tests.
 *
 * Notes:
 * - Unlike Number.parseFloat(String(...)), this helper is stricter and will
 *   only accept strings that are fully numeric (no trailing characters).
 * - This function helps avoid silently treating malformed values as 0.
 *
 * @param value - Unknown value to coerce to a finite number
 * @param opts - Optional configuration: label for logs, explicit fallback
 */
export function toFiniteNumber(
  value: unknown,
  opts?: { label?: string; fallback?: number | null; log?: boolean },
): number | null {
  const label = opts?.label ? `${opts.label} ` : "";
  const fallback = opts?.fallback ?? null;
  const isProduction =
    typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  const shouldLog = opts?.log ?? !isProduction;

  const warn = (message: string) => {
    if (!shouldLog) return;
    // Keep the message small and deterministic for tests and dev debugging.
    console.warn(`[toFiniteNumber] ${label}${message}`);
  };

  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    warn(`non-finite number: ${String(value)}`);
    return fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      warn(`empty string`);
      return fallback;
    }
    // Strict numeric test: only accept a full numeric string with optional exponent
    // Examples accepted: 10, -8.5, 1e3, 3.14E-2
    const numericRegex = /^[-+]?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/;
    if (!numericRegex.test(trimmed)) {
      warn(`non-numeric string: ${trimmed}`);
      return fallback;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed)) return parsed;
    warn(`parseFloat produced non-finite number: ${trimmed}`);
    return fallback;
  }

  warn(`unsupported type: ${typeof value}`);
  return fallback;
}

/**
 * Formats a byte count into a human-readable string using appropriate units (Bytes, KB, MB, GB).
 *
 * Divides the byte count by the appropriate power of 1024 and formats the number to the specified decimal precision.
 *
 * @param bytes - The number of bytes to format.
 * @param decimals - The number of decimal places (default: 2).
 * @returns A formatted string representing the size (e.g., "1.23 MB").
 * @source
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = Math.max(decimals, 0);
  const sizes = ["Bytes", "KB", "MB", "GB"];
  // Determine the appropriate unit based on the logarithm of the byte count.
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Calculate the size in the determined unit and format it.
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  );
}
