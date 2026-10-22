/**
 * The version a card URL carries, and the rules for reading one.
 *
 * A card URL has two parts that can change the card it returns: the card
 * configuration, and the stats the card draws. Each has its own write
 * timestamp, and a card URL has to move when either of them moves.
 *
 * The two timestamps are stored independently and move independently, so
 * taking the later of the two would hide a change in whichever one is
 * older. A user who saves their configuration and then gets a stats
 * refresh would keep the configuration's timestamp, the URL would not
 * move, and the cached copy of the card would keep showing the old
 * stats. The version therefore combines both values instead of choosing
 * between them.
 *
 * @source
 */

/**
 * Longest timestamp string accepted as a stored version.
 *
 * A timestamp is an ISO 8601 instant, which is 24 characters. The cap
 * keeps a corrupt or hostile stored value from becoming an unbounded
 * string that ends up in a URL.
 *
 * @source
 */
const MAX_TIMESTAMP_LENGTH = 40;

/**
 * Shape of an ISO 8601 instant.
 *
 * `Date.parse` accepts loose input, and a bare year is one of the shapes it
 * takes: `"9999"` parses as the year 9999, which is far enough in the future
 * that no real timestamp would ever exceed it. A version built from that
 * would never move again. Only the shape `toISOString` produces is accepted.
 *
 * @source
 */
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Reads a stored timestamp as a comparable instant.
 *
 * A stored value that is not a parseable date is rejected rather than
 * used. It cannot be compared against another timestamp, so treating it
 * as one would let it win a comparison it has no business winning, and
 * a version built from it would never move again.
 *
 * @param value - The stored value.
 * @returns The instant in milliseconds, or null when the value is not a date.
 * @source
 */
export function parseTimestampMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TIMESTAMP_LENGTH) return null;
  if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) return null;
  const millis = Date.parse(trimmed);
  if (!Number.isFinite(millis)) return null;
  return millis;
}

/**
 * Whether a stored value is usable as a version timestamp.
 *
 * Used at the write boundary, so a corrupt value never reaches storage.
 *
 * @param value - The candidate value.
 * @returns True when the value is a parseable timestamp.
 * @source
 */
export function isValidTimestamp(value: unknown): boolean {
  return parseTimestampMillis(value) !== null;
}

/**
 * Builds the version a card URL carries.
 *
 * Both timestamps contribute, so the version moves whenever either of them
 * does. The parts are sorted so the same pair of inputs always produces the
 * same version, whichever order they arrive in.
 *
 * The version is opaque: its value is never compared with another version,
 * only with itself to decide whether the URL changed. A caller that wants
 * to force a fresh card sends a `_t` parameter, whose value is likewise
 * irrelevant.
 *
 * @param dataUpdatedAt - When the stats behind the card last changed.
 * @param cardsUpdatedAt - When the card configuration last changed.
 * @returns A version string, or undefined when neither timestamp is usable.
 * @source
 */
export function buildCardVersion(
  dataUpdatedAt: unknown,
  cardsUpdatedAt: unknown,
): string | undefined {
  const parts: string[] = [];

  for (const value of [dataUpdatedAt, cardsUpdatedAt]) {
    const millis = parseTimestampMillis(value);
    if (millis === null) continue;
    // The millisecond form sorts and compares the same way every time,
    // whatever the original string looked like.
    parts.push(String(millis));
  }

  if (parts.length === 0) return undefined;

  parts.sort();
  return parts.join("-");
}

/**
 * Chooses the version to store when two writers disagree.
 *
 * A version must never move backwards. Two writers can hold different
 * versions for the same user at the same time, and the one that writes last
 * is not necessarily the one holding the newer version. The stored version
 * therefore wins whenever it is the later of the two.
 *
 * @param candidate - The version the writer would like to store.
 * @param stored - The version that is in storage right now.
 * @returns The version to store, or undefined when neither is usable.
 * @source
 */
export function resolveLatestTimestamp(
  candidate: unknown,
  stored: unknown,
): string | undefined {
  const candidateMillis = parseTimestampMillis(candidate);
  const storedMillis = parseTimestampMillis(stored);

  if (storedMillis === null) {
    return candidateMillis === null ? undefined : (candidate as string).trim();
  }
  if (candidateMillis === null) return (stored as string).trim();

  return storedMillis > candidateMillis
    ? (stored as string).trim()
    : (candidate as string).trim();
}
