/**
 * Bar-row builders shared by the card template families.
 *
 * Every bar chart renders the same shape: labelled counts, busiest first,
 * capped at the number of rows the card has space for. That ordering and cap
 * used to be re-implemented privately in each template, so the limits drifted
 * between cards. They live here now.
 *
 * @source
 */

/** A labelled count, the row shape every bar chart renders. @source */
type BarRow = {
  label: string;
  count: number;
};

/**
 * Turns a stat list into bar rows, sorted by count descending.
 *
 * Rows whose label is missing or blank are dropped: they render as an invisible
 * bar with a gap above it, which reads as a rendering fault rather than as data.
 *
 * @param items - Stat entries, or undefined when the record has none.
 * @param getLabel - Reads the bar label for an entry.
 * @param getCount - Reads the bar count for an entry.
 * @param limit - Maximum number of rows to keep.
 * @returns The busiest rows, at most `limit` of them.
 * @source
 */
export function toBarRows<T>(
  items: readonly T[] | undefined,
  getLabel: (item: T) => string | undefined,
  getCount: (item: T) => number,
  limit = 8,
): BarRow[] {
  const rows: BarRow[] = [];

  for (const item of items ?? []) {
    const label = getLabel(item);
    if (typeof label !== "string" || label.trim().length === 0) continue;
    rows.push({ label, count: getCount(item) });
  }

  return rows.toSorted((a, b) => b.count - a.count).slice(0, limit);
}
