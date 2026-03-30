export function isStrictPositiveIntegerString(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string") return false;
  return /^[1-9]\d*$/.test(value.trim());
}

export function parseStrictPositiveInteger(
  value: string | null | undefined,
): number | null {
  if (!isStrictPositiveIntegerString(value)) return null;

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
