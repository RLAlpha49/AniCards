/**
 * Small readers used while normalizing a stored user record.
 *
 * `isObject`, `getNestedString` and `coerceNumber` are how every other stage
 * reads a value it does not trust; `normalizePage` fills in the page shape the
 * record expects when the stored page is missing or malformed.
 *
 * @source
 */

/**
 * Type guard that verifies a value is a non-null object.
 * Prevents unsafe property access when traversing nested data.
 * @source
 */
export const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

/**
 * Safely resolves a nested string or number property by path.
 * Returns an empty string if any portion of the path is missing or not a string/number.
 * @param root - The root object to traverse.
 * @param path - Array of keys to navigate into nested objects.
 * @returns Resolved string value or empty string.
 * @source
 */
export const getNestedString = (root: unknown, path: string[]): string => {
  let node: unknown = root;
  for (const seg of path) {
    if (!isObject(node)) return "";
    const recNode = node;
    node = recNode[seg];
  }
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  return "";
}; // isObject, getNestedString

/**
 * Internal representation of paginated data from the API.
 * Ensures a stable pageInfo.total and provides a typed items array.
 * @source
 */
export interface NormalizedPage {
  pageInfo: { total: number };
  [k: string]: unknown;
}

/**
 * Normalizes paginated responses into a consistent structure with pageInfo and items.
 * This function accepts potentially malformed values and ensures defaults: total=0 and empty items array.
 * @param value - The raw paginated object.
 * @param keyNames - Key name that contains the items array (e.g., { itemsKey: 'followers' }).
 * @returns Normalized page structure.
 * @source
 */
export const normalizePage = (
  value: unknown,
  keyNames: { itemsKey: string },
): NormalizedPage => {
  if (!value || typeof value !== "object") {
    return {
      pageInfo: { total: 0 },
      [keyNames.itemsKey]: [],
    } as NormalizedPage;
  }
  const v = value as Record<string, unknown>;
  const pageInfoCandidate = v.pageInfo as Record<string, unknown> | undefined;
  const pageInfo =
    pageInfoCandidate && typeof pageInfoCandidate.total === "number"
      ? { total: pageInfoCandidate.total }
      : { total: 0 };
  const items = Array.isArray(v[keyNames.itemsKey])
    ? (v[keyNames.itemsKey] as unknown[])
    : [];
  return { pageInfo, [keyNames.itemsKey]: items } as NormalizedPage;
}; // NormalizedPage + normalizePage

/**
 * Attempts to coerce a value to a finite number.
 * Accepts numbers and numeric strings, returns a fallback or undefined if conversion fails.
 * @param value - Value to coerce to a number.
 * @param fallback - Optional fallback value used when coercion fails.
 * @returns A finite number or fallback/undefined.
 * @source
 */
export const coerceNumber = (
  value: unknown,
  fallback?: number,
): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  )
    return Number(value);
  return fallback;
}; // coerceNumber
