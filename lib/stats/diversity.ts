/**
 * Shannon diversity helpers.
 *
 * Two "diversity" cards and one stored aggregate used to compute this index
 * with two different formulas, so the same counts could score differently
 * depending on which card rendered them. The math now lives here and every
 * caller imports it, so a diversity percentage means one thing.
 *
 * @source
 */

/**
 * Computes the Shannon entropy of a set of counts, in nats.
 *
 * Uses the identity `H = ln(T) - (Σ cᵢ ln cᵢ) / T`, where `T` is the total of
 * the positive counts. Non-finite and non-positive counts are ignored, so a
 * hole in the stored data lowers the total rather than poisoning the result.
 *
 * @param counts - Counts, one per category.
 * @returns The entropy, or 0 when nothing was counted.
 * @source
 */
export function shannonDiversityIndex(counts: readonly number[]): number {
  let total = 0;
  let sumCLogC = 0;

  for (const raw of counts) {
    if (!Number.isFinite(raw)) continue;
    const c = Math.max(0, raw);
    if (c <= 0) continue;
    total += c;
    sumCLogC += c * Math.log(c);
  }

  if (total <= 0) return 0;

  return Math.log(total) - sumCLogC / total;
}

/**
 * Normalizes the Shannon entropy to a 0-1 index.
 *
 * The divisor is the maximum entropy of the observed data, `ln(k)`, where `k`
 * is the number of positive counts. A set spread evenly over every observed
 * category scores 1; a set concentrated in one scores 0.
 *
 * @param counts - Counts, one per category.
 * @returns The index in the range 0-1.
 * @source
 */
export function normalizedShannon(counts: readonly number[]): number {
  let distinct = 0;
  for (const c of counts) {
    if (Number.isFinite(c) && c > 0) distinct += 1;
  }
  if (distinct <= 1) return 0;

  const hMax = Math.log(distinct);
  if (hMax <= 0) return 0;

  return Math.max(0, Math.min(1, shannonDiversityIndex(counts) / hMax));
}
