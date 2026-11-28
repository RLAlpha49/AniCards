export function formatInt(n: number | undefined | null): string {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("en-US");
}

export function formatScore(n: number | undefined | null): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toFixed(1);
}

export function formatPercent(
  numerator: number,
  denominator: number,
  digits = 0,
): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return `0%`;
  }
  if (denominator <= 0) return `0%`;
  const pct = (numerator / denominator) * 100;
  return `${pct.toFixed(digits)}%`;
}
