export function isStrictPositiveIntegerString(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string") return false;
  return /^[1-9]\d*$/.test(value.trim());
}

export function normalizePositiveIntegerString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!/^\d+$/.test(trimmedValue)) {
    return null;
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return String(parsedValue);
}

export function parseStrictPositiveInteger(
  value: string | null | undefined,
): number | null {
  if (!isStrictPositiveIntegerString(value)) return null;

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
