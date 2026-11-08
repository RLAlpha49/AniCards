import { escapeForXml, markTrustedSvg } from "@/lib/utils";
import type { TrustedSVG } from "@/lib/types/svg";

/**
 * Canvas size of an error card.
 *
 * The image is scaled down to whatever width its container gives it, so the
 * only thing that decides whether the message can be read is the font size
 * relative to this width. A card is shown in slots around 210 CSS pixels
 * wide, where a 400-pixel canvas with 24-pixel text still paints at about 12
 * pixels. An 800-pixel canvas painted the same text at about 5.
 *
 * @source
 */
export const ERROR_SVG_WIDTH = 400;
export const ERROR_SVG_HEIGHT = 200;

/** Font size, line height, and horizontal padding for the error message. @source */
export const ERROR_TEXT_FONT_SIZE = 24;
export const ERROR_TEXT_LINE_HEIGHT = 30;
export const ERROR_TEXT_PADDING_X = 20;

/**
 * Share of the font size that one monospace glyph occupies.
 *
 * Used to estimate how many characters fit on a line without shipping a text
 * measuring library. Monospace glyphs are close to this ratio, and an
 * underestimate only shortens the line.
 *
 * @source
 */
const MONOSPACE_GLYPH_RATIO = 0.6;

/** Characters that fit on one line of the error card. @source */
export const ERROR_TEXT_MAX_CHARS = Math.max(
  1,
  Math.floor(
    (ERROR_SVG_WIDTH - ERROR_TEXT_PADDING_X * 2) /
      (ERROR_TEXT_FONT_SIZE * MONOSPACE_GLYPH_RATIO),
  ),
);

/** Lines shown before the message is truncated. @source */
export const ERROR_TEXT_MAX_LINES = 6;

/**
 * Splits a word that cannot fit a line into line-sized pieces.
 *
 * @param word - The word to break.
 * @returns The pieces, in order.
 * @source
 */
function breakLongWord(word: string): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < word.length; i += ERROR_TEXT_MAX_CHARS) {
    pieces.push(word.slice(i, i + ERROR_TEXT_MAX_CHARS));
  }
  return pieces;
}

/**
 * Lays out one paragraph, appending its lines to `lines`.
 *
 * @param paragraph - Paragraph text, already split on newlines.
 * @param lines - Lines collected so far, appended to in place.
 * @source
 */
function wrapParagraph(paragraph: string, lines: string[]): void {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);
  let line = "";

  for (const word of words) {
    if (word.length > ERROR_TEXT_MAX_CHARS) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(...breakLongWord(word));
      continue;
    }

    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= ERROR_TEXT_MAX_CHARS) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }

  if (line) lines.push(line);
}

/**
 * Shortens the kept lines to the count the card shows.
 *
 * The last kept line ends in an ellipsis, so a truncated message looks
 * truncated instead of stopping mid-sentence.
 *
 * @param lines - Every wrapped line.
 * @returns At most {@link ERROR_TEXT_MAX_LINES} lines.
 * @source
 */
function limitLines(lines: string[]): string[] {
  if (lines.length === 0) return [""];
  if (lines.length <= ERROR_TEXT_MAX_LINES) return lines;

  const kept = lines.slice(0, ERROR_TEXT_MAX_LINES);
  const lastIndex = kept.length - 1;
  kept[lastIndex] =
    `${kept[lastIndex].slice(0, ERROR_TEXT_MAX_CHARS - 3).trimEnd()}...`;
  return kept;
}

/**
 * Splits a message into lines that fit the error card.
 *
 * Words stay whole where they fit. A word longer than a line is broken,
 * because leaving it whole would push it past the canvas and clip it. When
 * the message needs more lines than the card shows, the extra lines are
 * dropped and the last kept line ends in an ellipsis, so a truncated message
 * looks truncated instead of stopping mid-sentence.
 *
 * @param message - The raw message to lay out.
 * @returns The lines to render, already limited in count.
 * @source
 */
export function wrapErrorText(message: string): string[] {
  const lines: string[] = [];

  for (const paragraph of String(message ?? "").split(/\r?\n/)) {
    wrapParagraph(paragraph, lines);
  }

  return limitLines(lines);
}

/**
 * Builds the error card SVG for a message.
 *
 * Each line is escaped separately to avoid SVG injection, and the block of
 * lines is centered on the canvas.
 *
 * @param message - The human-readable message to display.
 * @returns A TrustedSVG containing one tspan per wrapped line.
 * @source
 */
export function buildErrorCardSvg(message: string): TrustedSVG {
  const lines = wrapErrorText(message);
  const blockHeight = (lines.length - 1) * ERROR_TEXT_LINE_HEIGHT;
  const firstLineY = (ERROR_SVG_HEIGHT - blockHeight) / 2;
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="50%" y="${firstLineY + index * ERROR_TEXT_LINE_HEIGHT}">${escapeForXml(line)}</tspan>`,
    )
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
  <svg width="${ERROR_SVG_WIDTH}" height="${ERROR_SVG_HEIGHT}" viewBox="0 0 ${ERROR_SVG_WIDTH} ${ERROR_SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .error-text {
        font-family: monospace;
        font-size: ${ERROR_TEXT_FONT_SIZE}px;
        fill: #ff5555;
      }
    </style>
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text class="error-text" text-anchor="middle" dominant-baseline="middle">${tspans}</text>
  </svg>`;
  return markTrustedSvg(svg);
}
