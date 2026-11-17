/**
 * Advance-width metrics for the card font stack (`'Segoe UI', Ubuntu,
 * Sans-Serif`), in em units, measured from the font itself in Chromium rather
 * than guessed per character class.
 *
 * Charts are generated as SVG strings on the server, so nothing can call
 * `getComputedTextLength()` while laying out. Every label that must fit a
 * budget therefore relies on an estimate. The earlier estimates assigned a
 * width to each character by script class and were wrong in both directions:
 * they over-measured ordinary prose by up to 2.5x, which squeezed text with
 * `lengthAdjust="spacingAndGlyphs"` or truncated it while space remained.
 *
 * The tables below replace those guesses with measured advances. Each weight
 * lists code points 32..126 in order, then named entries for the punctuation
 * and letters that occur in media titles.
 *
 * If the font stack changes, measure again in Chromium at 100px and replace
 * the tables. There is no script for it: the measurement needs a browser.
 * @source
 */

/** Characters measured in order, starting at code point 32 (space). @source */
const ASCII_START = 32;

/**
 * Measured advance widths in em for `400 100px 'Segoe UI', Ubuntu,
 * Sans-Serif`, code points 32..126.
 * @source
 */
const ADVANCES_400 = [
  0.274, 0.284, 0.392, 0.591, 0.539, 0.818, 0.8, 0.23, 0.302, 0.302, 0.417,
  0.684, 0.217, 0.4, 0.217, 0.39, 0.539, 0.539, 0.539, 0.539, 0.539, 0.539,
  0.539, 0.539, 0.539, 0.539, 0.217, 0.217, 0.684, 0.684, 0.684, 0.448, 0.955,
  0.645, 0.573, 0.619, 0.701, 0.506, 0.488, 0.686, 0.71, 0.266, 0.357, 0.58,
  0.471, 0.898, 0.748, 0.754, 0.56, 0.754, 0.598, 0.531, 0.524, 0.687, 0.621,
  0.934, 0.59, 0.553, 0.57, 0.302, 0.379, 0.302, 0.684, 0.415, 0.268, 0.509,
  0.588, 0.462, 0.589, 0.523, 0.313, 0.589, 0.566, 0.242, 0.242, 0.497, 0.242,
  0.861, 0.566, 0.586, 0.588, 0.589, 0.348, 0.424, 0.339, 0.566, 0.479, 0.723,
  0.459, 0.484, 0.452, 0.302, 0.239, 0.302, 0.684,
] as const;

/**
 * Measured advance widths in em for `600 100px 'Segoe UI', Ubuntu,
 * Sans-Serif`, code points 32..126. Segoe UI weight 600 resolves to the same
 * glyph advances as 500 in Chromium.
 * @source
 */
const ADVANCES_600 = [
  0.275, 0.304, 0.438, 0.591, 0.555, 0.84, 0.715, 0.258, 0.332, 0.332, 0.434,
  0.694, 0.241, 0.402, 0.241, 0.414, 0.555, 0.402, 0.555, 0.555, 0.576, 0.555,
  0.558, 0.536, 0.555, 0.558, 0.241, 0.241, 0.694, 0.694, 0.694, 0.444, 0.955,
  0.671, 0.604, 0.621, 0.717, 0.518, 0.502, 0.697, 0.735, 0.292, 0.396, 0.611,
  0.489, 0.924, 0.767, 0.756, 0.584, 0.756, 0.623, 0.544, 0.552, 0.703, 0.642,
  0.966, 0.619, 0.577, 0.587, 0.332, 0.405, 0.332, 0.694, 0.415, 0.289, 0.522,
  0.603, 0.47, 0.603, 0.531, 0.345, 0.603, 0.582, 0.261, 0.261, 0.525, 0.261,
  0.886, 0.583, 0.597, 0.603, 0.603, 0.37, 0.431, 0.361, 0.583, 0.507, 0.756,
  0.501, 0.508, 0.464, 0.332, 0.278, 0.332, 0.694,
] as const;

/**
 * Measured advance widths in em for `700 100px 'Segoe UI', Ubuntu,
 * Sans-Serif`, code points 32..126.
 * @source
 */
const ADVANCES_700 = [
  0.276, 0.327, 0.493, 0.592, 0.575, 0.867, 0.85, 0.293, 0.369, 0.369, 0.455,
  0.707, 0.271, 0.404, 0.271, 0.443, 0.575, 0.575, 0.575, 0.575, 0.575, 0.575,
  0.575, 0.575, 0.575, 0.575, 0.271, 0.271, 0.707, 0.707, 0.707, 0.438, 0.954,
  0.703, 0.641, 0.624, 0.737, 0.532, 0.52, 0.711, 0.766, 0.317, 0.445, 0.649,
  0.511, 0.957, 0.79, 0.758, 0.614, 0.758, 0.653, 0.561, 0.586, 0.723, 0.667,
  1.005, 0.655, 0.607, 0.607, 0.369, 0.436, 0.369, 0.707, 0.415, 0.314, 0.538,
  0.62, 0.48, 0.619, 0.541, 0.383, 0.619, 0.602, 0.284, 0.284, 0.559, 0.284,
  0.916, 0.605, 0.611, 0.62, 0.619, 0.398, 0.44, 0.389, 0.605, 0.542, 0.797,
  0.552, 0.538, 0.479, 0.369, 0.326, 0.369, 0.707,
] as const;

/** Advances for characters outside the ASCII range that card labels use. @source */
const EXTRA_400: Record<string, number> = {
  "…": 0.733, "—": 1, "–": 0.5, "·": 0.217, "•": 0.406, "’": 0.229, "‘": 0.229,
  "“": 0.377, "”": 0.377, "é": 0.523, "á": 0.509, "ü": 0.566, "ö": 0.586,
  "ñ": 0.566, "ç": 0.462, "ß": 0.544, "ø": 0.586, "å": 0.509, "★": 0.833,
  "♥": 0.685, "♪": 0.5, "→": 0.863, "×": 0.684,
};

/** @source */
const EXTRA_600: Record<string, number> = {
  "…": 0.813, "—": 1, "–": 0.5, "·": 0.241, "•": 0.414, "’": 0.256, "‘": 0.256,
  "“": 0.429, "”": 0.429, "é": 0.531, "á": 0.522, "ü": 0.583, "ö": 0.597,
  "ñ": 0.583, "ç": 0.47, "ß": 0.582, "ø": 0.597, "å": 0.522, "★": 0.833,
  "♥": 0.685, "♪": 0.5, "→": 0.863, "×": 0.694,
};

/** @source */
const EXTRA_700: Record<string, number> = {
  "…": 0.912, "—": 1, "–": 0.5, "·": 0.271, "•": 0.422, "’": 0.29, "‘": 0.29,
  "“": 0.493, "”": 0.493, "é": 0.541, "á": 0.538, "ü": 0.605, "ö": 0.611,
  "ñ": 0.605, "ç": 0.48, "ß": 0.628, "ø": 0.611, "å": 0.538, "★": 0.833,
  "♥": 0.685, "♪": 0.5, "→": 0.863, "×": 0.707,
};

/**
 * Advance width in em for a code point whose script the tables do not cover.
 * Full-width CJK advances exactly 1em in the fallback font; other unmapped
 * characters are assumed to be average Latin letters.
 * @source
 */
const DEFAULT_ADVANCE = 0.62;

/** Font weights the tables cover. Callers pass the weight their CSS uses. @source */
export type CardFontWeight = 400 | 600 | 700;

function tableFor(weight: CardFontWeight): readonly number[] {
  if (weight === 700) return ADVANCES_700;
  if (weight === 600) return ADVANCES_600;
  return ADVANCES_400;
}

function extraFor(weight: CardFontWeight): Record<string, number> {
  if (weight === 700) return EXTRA_700;
  if (weight === 600) return EXTRA_600;
  return EXTRA_400;
}

/**
 * Estimates the rendered width of `text` in pixels for the card font stack.
 *
 * @param text - The string to measure.
 * @param fontSize - Font size in pixels.
 * @param weight - The weight the element renders at. Cards use 400 for body
 *   text, 600 for labels and headings, and 700 for emphasised values.
 * @returns The estimated advance width in pixels.
 * @source
 */
export function estimateCardTextWidth(
  text: string,
  fontSize: number,
  weight: CardFontWeight = 400,
): number {
  const advances = tableFor(weight);
  const extras = extraFor(weight);
  let em = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= ASCII_START && code < ASCII_START + advances.length) {
      em += advances[code - ASCII_START];
    } else if (extras[character] !== undefined) {
      em += extras[character];
    } else if (
      // Full-width CJK, Hiragana, Katakana, and Hangul advance exactly 1em.
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff01 && code <= 0xff60)
    ) {
      em += 1;
    } else {
      em += DEFAULT_ADVANCE;
    }
  }
  return em * fontSize;
}

/**
 * Returns the largest prefix of `text` that fits `maxWidth`, with an ellipsis
 * appended when characters were dropped.
 *
 * Uses binary search over the prefix length so long titles stay O(log n) in
 * measurement calls rather than one call per character.
 *
 * @param text - The full string.
 * @param maxWidth - Available width in pixels.
 * @param fontSize - Font size in pixels.
 * @param weight - The weight the element renders at.
 * @returns The original string when it fits, otherwise an ellipsised prefix.
 * @source
 */
export function fitCardText(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: CardFontWeight = 400,
): string {
  const characters = Array.from(text);
  if (maxWidth <= 0) return "";
  // Allow a hair of tolerance: the caller's budget and this estimate are both
  // floating point, so a sub-pixel miss should not cost a whole character.
  if (estimateCardTextWidth(text, fontSize, weight) <= maxWidth + 0.5) {
    return text;
  }

  const ellipsis = "…";
  const ellipsisWidth = estimateCardTextWidth(ellipsis, fontSize, weight);
  if (ellipsisWidth > maxWidth) return "";

  let low = 0;
  let high = characters.length - 1;
  let best = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = characters.slice(0, mid).join("").trimEnd() + ellipsis;
    if (estimateCardTextWidth(candidate, fontSize, weight) <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (best <= 0) return ellipsis;
  return characters.slice(0, best).join("").trimEnd() + ellipsis;
}

/**
 * Chooses a font size that makes `text` fit `maxWidth`, never exceeding
 * `maxFontSize` and never dropping below `minFontSize`.
 *
 * Mirrors `fitCardText` for callers that shrink type instead of truncating.
 *
 * @param text - The string to fit.
 * @param maxWidth - Available width in pixels.
 * @param maxFontSize - The preferred (largest) font size.
 * @param weight - The weight the element renders at.
 * @param minFontSize - The smallest acceptable font size (default 8).
 * @returns The font size in pixels, rounded down to one decimal place.
 * @source
 */
export function fitCardFontSize(
  text: string,
  maxWidth: number,
  maxFontSize: number,
  weight: CardFontWeight = 400,
  minFontSize = 8,
): number {
  if (maxWidth <= 0) return minFontSize;
  const naturalWidth = estimateCardTextWidth(text, maxFontSize, weight);
  if (naturalWidth <= maxWidth) return maxFontSize;
  const scaled = (maxFontSize * maxWidth) / naturalWidth;
  return Math.max(minFontSize, Math.floor(scaled * 10) / 10);
}