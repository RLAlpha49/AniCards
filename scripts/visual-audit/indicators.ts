/**
 * Signals that a rendered card is showing a fallback rather than data.
 *
 * A visually correct capture of an empty card is still a failed audit of that
 * card, so the capture records why a card might be empty instead of leaving a
 * reviewer to notice a blank panel. These are indicators, not proof: the
 * manifest says so, and the report repeats it.
 *
 * Text is matched against the phrases templates actually render, which are
 * fixed strings in `lib/svg-templates`. Kept as a list rather than one regex
 * so an empty state added to a template is a one-line change here. A phrase
 * only counts when it fills a whole text node: subtitles and titles can
 * legitimately contain the same words.
 *
 * @source
 */

/** Phrases templates render in place of missing data. @source */
const EMPTY_STATE_PHRASES = [
  "No data",
  "No entries",
  "No milestones yet",
  "No planned titles found",
  "No rewatched or reread titles found",
  "No top activity days detected",
  "No currently watching/reading entries found",
  "Nothing to show",
  "Not enough data",
];

/** Class on the rectangle a favourites grid draws for a missing cover. @source */
const PLACEHOLDER_CELL_CLASS = "item-placeholder";

/** An embedded image that points at the network rather than carrying bytes. @source */
const REMOTE_IMAGE = /<image\b[^>]*(?:href|xlink:href)\s*=\s*["']https?:/i;

/**
 * Escapes a string for use inside a regular expression.
 * @param value - Literal text.
 * @returns The text with regex metacharacters escaped.
 * @source
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Escapes a string for use in an HTML text node.
 * @param value - Raw text.
 * @returns Escaped text.
 * @source
 */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

/**
 * Finds empty-state text in a rendered SVG.
 *
 * @param svg - Rendered SVG source.
 * @returns One entry per distinct phrase found.
 * @source
 */
export function findEmptyStateText(svg: string): string[] {
  const found = new Set<string>();
  for (const phrase of EMPTY_STATE_PHRASES) {
    const pattern = new RegExp(`>\\s*${escapeRegExp(phrase)}\\s*<`, "i");
    if (pattern.test(svg)) found.add(phrase);
  }
  return [...found];
}

/**
 * Collects every fallback indicator for one rendered card.
 *
 * @param svg - Rendered SVG source.
 * @returns Human-readable descriptions, empty when nothing looked wrong.
 * @source
 */
export function findFallbackIndicators(svg: string): string[] {
  const indicators = findEmptyStateText(svg);
  if (new RegExp(`<rect\\b[^>]*class="${PLACEHOLDER_CELL_CLASS}"`).test(svg)) {
    indicators.push("Grid contains placeholder cells or artwork");
  }
  return indicators;
}

/**
 * Checks whether a rendered SVG embeds images from the network.
 *
 * The capture blocks the network before rendering, so a remote URL here means
 * the SVG was built with a link rather than embedded bytes and would render
 * differently on another machine.
 *
 * @param svg - Rendered SVG source.
 * @returns True when a remote URL was found.
 * @source
 */
export function hasRemoteImage(svg: string): boolean {
  return REMOTE_IMAGE.test(svg);
}

/**
 * Checks that a rendered SVG is a complete document.
 * @param svg - Rendered SVG source.
 * @returns True when both the opening and closing tags are present.
 * @source
 */
export function isCompleteSvg(svg: string): boolean {
  return svg.includes("<svg") && svg.includes("</svg>");
}
