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

export function sumByKey<T>(
  items: T[],
  getKey: (item: T) => string,
  getCount: (item: T) => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item).trim();
    if (!key) continue;
    const c = getCount(item);
    const count = Number.isFinite(c) ? Math.max(0, c) : 0;
    map.set(key, (map.get(key) ?? 0) + count);
  }
  return map;
}

export function mapToSortedRows(
  map: Map<string, number>,
  limit: number,
): { label: string; count: number }[] {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, limit);
}
