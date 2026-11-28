/**
 * CSS sanitizing for the SVG conversion endpoint.
 *
 * The converter accepts an SVG it fetched from an allow-listed origin and
 * renders it with sharp. Animations, vendor keyframes and hidden states are
 * removed first: a rasterized frame cannot animate, and a rule that hides a
 * node until a keyframe runs would rasterize as an empty area.
 *
 * Everything here is string work over CSS. It has no HTTP knowledge, so the
 * route parses the request, calls {@link optimizeSvgMarkup}, and responds.
 *
 * @source
 */

import {
  removeClassTokensFromMarkup,
  sanitizeInlineStyleAttributes,
} from "@/lib/server/svg-markup-cleanup";

/**
 * Determines whether a CSS fragment contains only whitespace or block comments.
 * @param substr - The fragment to inspect for meaningful characters.
 * @returns True when the fragment has no characters outside of whitespace or comments.
 * @source
 */
function isWhitespaceOrComments(substr: string): boolean {
  let inComment = false;
  let i = 0;
  while (i < substr.length) {
    const ch = substr[i];
    const nxt = substr[i + 1];
    if (inComment) {
      // Found end of comment marker '*/'
      if (ch === "*" && nxt === "/") {
        inComment = false;
        i += 2; // skip '*/'
        continue;
      }
      i += 1;
      continue;
    }
    // Start of a comment '/*'
    if (ch === "/" && nxt === "*") {
      inComment = true;
      i += 2; // skip '/*'
      continue;
    }
    if (!/\s/.test(ch)) return false;
    i += 1;
  }
  return !inComment;
}

/**
 * Skips forward from a slash-star comment opener and returns the index immediately
 * after the closing star-slash pair.
 * @param input - The CSS input containing the comment.
 * @param start - Index pointing at the '/' that begins the comment.
 * @returns Position after the matching closing sequence or the string end.
 * @source
 */
function advanceIndexPastEndOfComment(input: string, start: number): number {
  // start points to '/' and next is '*'
  let j = start + 2;
  while (j < input.length) {
    if (input[j] === "*" && input[j + 1] === "/") return j + 2; // position after '*/'
    j += 1;
  }
  return j;
}

/**
 * Advances past a quoted segment while honoring escaped quotes.
 * @param input - String containing the quoted segment.
 * @param start - Index of the opening quote.
 * @param quote - Quote character to match.
 * @returns Index immediately after the closing quote or the input length.
 * @source
 */
function advanceIndexPastEndOfQuote(
  input: string,
  start: number,
  quote: "'" | '"',
): number {
  let j = start + 1;
  while (j < input.length) {
    // treat escaped quotes as not closing
    if (input[j] === quote && input[j - 1] !== "\\") return j + 1; // position after closing quote
    j += 1;
  }
  return j;
}

/**
 * Locates the closing brace that balances the opening brace at `openIdx` while
 * skipping over quoted strings and comment blocks.
 * @param input - CSS text containing the brace pair.
 * @param openIdx - Index of the opening '{'.
 * @returns Index immediately after the matching closing '}' or the input length.
 * @source
 */
function findMatchingBraceEndIndex(input: string, openIdx: number): number {
  let depth = 1;
  let j = openIdx + 1;
  while (j < input.length && depth > 0) {
    const ch = input[j];
    const nxt = input[j + 1];
    // skip comments
    if (ch === "/" && nxt === "*") {
      j = advanceIndexPastEndOfComment(input, j);
      continue;
    }
    // skip quoted strings
    if (ch === "'") {
      j = advanceIndexPastEndOfQuote(input, j, "'");
      continue;
    }
    if (ch === '"') {
      j = advanceIndexPastEndOfQuote(input, j, '"');
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    j++;
  }
  return j;
}

/**
 * Finds the next opening brace '{' after `start`, ignoring comments and quotes.
 * @param input - CSS content to scan.
 * @param start - Index at which to begin searching.
 * @returns Index of the next '{' or the string length when missing.
 * @source
 */
function findOpeningBraceIndex(input: string, start: number): number {
  let j = start;
  while (j < input.length && input[j] !== "{") {
    const ch = input[j];
    const nxt = input[j + 1];
    if (ch === "/" && nxt === "*") {
      j = advanceIndexPastEndOfComment(input, j);
      continue;
    }
    if (ch === "'") {
      j = advanceIndexPastEndOfQuote(input, j, "'");
      continue;
    }
    if (ch === '"') {
      j = advanceIndexPastEndOfQuote(input, j, '"');
      continue;
    }
    j += 1;
  }
  return j;
}

/**
 * Builds a list of CSS blocks that record selector positions and matching braces.
 * @param input - CSS text to inspect.
 * @returns Metadata for each block outlining selector start/end and brace positions.
 * @source
 */
function collectCssBlocks(input: string): Array<{
  selectorStart: number;
  selectorEnd: number;
  openIdx: number;
  closeIdx: number;
}> {
  const blocks = [] as Array<{
    selectorStart: number;
    selectorEnd: number;
    openIdx: number;
    closeIdx: number;
  }>;
  const stack: number[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const nxt = input[i + 1];
    // skip comments
    if (ch === "/" && nxt === "*") {
      i = advanceIndexPastEndOfComment(input, i);
      continue;
    }
    // skip quotes
    if (ch === "'") {
      i = advanceIndexPastEndOfQuote(input, i, "'");
      continue;
    }
    if (ch === '"') {
      i = advanceIndexPastEndOfQuote(input, i, '"');
      continue;
    }
    if (ch === "{") {
      stack.push(i);
      i += 1;
      continue;
    }
    if (ch === "}") {
      if (stack.length === 0) {
        i += 1;
        continue;
      }
      const openIdx = stack.pop()!;
      const start = findSelectorStart(input, openIdx);
      blocks.push({
        selectorStart: start,
        selectorEnd: openIdx,
        openIdx,
        closeIdx: i,
      });
      i += 1;
      continue;
    }
    i += 1;
  }
  return blocks;
}

/**
 * Finds spans that cover CSS rules whose block contains only whitespace or comments.
 * @param input - CSS to analyze for empty rules.
 * @returns Array of selector-to-brace ranges that can be removed.
 * @source
 */
function findEmptyCssRanges(input: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const blocks = collectCssBlocks(input);
  for (const b of blocks) {
    const inner = input.slice(b.openIdx + 1, b.closeIdx);
    if (isWhitespaceOrComments(inner)) {
      ranges.push([b.selectorStart, b.closeIdx + 1]);
    }
  }
  return ranges;
}

/**
 * Locates the selector start that precedes the brace at `openIdx`.
 * @param input - CSS text containing the selector.
 * @param openIdx - Index of the opening brace for the rule.
 * @returns Index where the selector begins.
 * @source
 */
function findSelectorStart(input: string, openIdx: number): number {
  let start = openIdx - 1;
  while (start >= 0 && /\s/.test(input[start])) start -= 1;
  while (
    start >= 0 &&
    input[start] !== "}" &&
    input[start] !== "{" &&
    input[start] !== ";"
  ) {
    start -= 1;
  }
  return start + 1;
}

/**
 * Merges overlapping or contiguous ranges into a compact list.
 * @param ranges - Ranges to merge.
 * @returns Combined list of disjoint ranges.
 * @source
 */
function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of sorted) {
    if (merged.length === 0) merged.push(r);
    else {
      const lastR = merged.at(-1)!;
      if (r[0] <= lastR[1]) lastR[1] = Math.max(lastR[1], r[1]);
      else merged.push(r);
    }
  }
  return merged;
}

/**
 * Rebuilds input without the slices specified by `ranges`.
 * @param input - Original string to trim.
 * @param ranges - Spans that should be omitted.
 * @returns String with the ranges removed.
 * @source
 */
function removeRangesFromInput(
  input: string,
  ranges: Array<[number, number]>,
): string {
  if (ranges.length === 0) return input;
  let out = "";
  let pos = 0;
  for (const [s, e] of ranges) {
    out += input.slice(pos, s);
    pos = e;
  }
  out += input.slice(pos);
  return out;
}

/**
 * Performs one sweep to remove empty CSS blocks and report whether any were removed.
 * @param input - CSS string to inspect.
 * @returns Updated CSS and a flag indicating removal.
 * @source
 */
function removeEmptyCssBlocksOnce(input: string): {
  css: string;
  removed: boolean;
} {
  const rangesToRemove = findEmptyCssRanges(input);
  if (rangesToRemove.length === 0) return { css: input, removed: false };
  const merged = mergeRanges(rangesToRemove);
  const out = removeRangesFromInput(input, merged);
  return { css: out, removed: true };
}

/**
 * Iteratively deletes empty CSS rules until no removable blocks remain.
 * @param css - CSS text to sanitize.
 * @returns CSS with all empty blocks stripped.
 * @source
 */
export function removeEmptyCssRules(css: string): string {
  if (!css?.includes("{")) return css;
  let last = css;
  while (true) {
    const { css: nextCss, removed } = removeEmptyCssBlocksOnce(last);
    if (!removed) break;
    last = nextCss;
  }
  return last;
}

/**
 * Removes brace-delimited at-rule blocks for a specific rule name.
 * @param inputCss - CSS text to scan.
 * @param atRuleName - At-rule name without the leading '@'.
 * @returns CSS with those at-rule blocks removed.
 * @source
 */
function removeAtRuleBlocks(inputCss: string, atRuleName: string): string {
  const lc = inputCss.toLowerCase();
  const needle = `@${atRuleName.toLowerCase()}`;
  let out = "";
  let i = 0;
  while (i < inputCss.length) {
    const idx = lc.indexOf(needle, i);
    if (idx === -1) {
      out += inputCss.slice(i);
      break;
    }
    // Append thing before the at-rule
    out += inputCss.slice(i, idx);
    // Find opening brace for the at-rule, while respecting quotes/comments
    const j = findOpeningBraceIndex(inputCss, idx);
    if (j >= inputCss.length) break; // malformed at-rule without block
    // Find the end of the brace-block using helper
    const endIndex = findMatchingBraceEndIndex(inputCss, j);
    i = endIndex;
  }
  return out;
}

/**
 * Splits selectors on commas while skipping commas inside parentheses.
 * @param selectorText - Selector list string to split.
 * @returns Trimmed selectors that were outside of parentheses.
 * @source
 */
function splitSelectors(selectorText: string): string[] {
  const selectors: string[] = [];
  let cur = "";
  let depth = 0;
  let i = 0;
  while (i < selectorText.length) {
    const ch = selectorText[i];
    switch (ch) {
      case "'": {
        const end = advanceIndexPastEndOfQuote(selectorText, i, "'");
        cur += selectorText.slice(i, end);
        i = end;
        break;
      }
      case '"': {
        const end = advanceIndexPastEndOfQuote(selectorText, i, '"');
        cur += selectorText.slice(i, end);
        i = end;
        break;
      }
      case "(": {
        depth += 1;
        cur += ch;
        i += 1;
        break;
      }
      case ")": {
        if (depth > 0) depth -= 1;
        cur += ch;
        i += 1;
        break;
      }
      case ",": {
        if (depth === 0) {
          selectors.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
        i += 1;
        break;
      }
      default: {
        cur += ch;
        i += 1;
      }
    }
  }
  if (cur.trim().length > 0) selectors.push(cur.trim());
  return selectors;
}

/**
 * Detects whether a selector contains a specific class token without matching
 * substrings of longer class names.
 * @param selector - Selector text to inspect.
 * @param className - Class token to find.
 * @returns True when the class token exists at a standalone position.
 * @source
 */
function selectorContainsClass(selector: string, className: string): boolean {
  // Match a class token such as `.stagger` anywhere inside a selector but avoid
  // matching a substring of a longer class name (e.g., `.stagger-other`). We use
  // a negative lookahead to ensure the following character is not a valid class
  // name character (letters, digits, underscore or hyphen).
  const safeName = className.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const rx = new RegExp(String.raw`\.${safeName}(?![A-Za-z0-9_-])`, "i");
  return rx.test(selector);
}

/**
 * Drops animation-related properties and normalizes visibility/opacity.
 * @param inner - CSS block content to scrub.
 * @returns CSS block with animation controls and hidden states removed.
 * @source
 */
function removeAnimationPropertiesFromBlock(inner: string): string {
  // Remove animation shorthand and vendor-prefixed variants, as well as
  // sub-properties like animation-delay, animation-name, etc.
  inner = inner.replaceAll(
    /(?:-webkit-|-moz-|-ms-)?animation(?:-[\w-]+)?\s*:\s*[^;]+;?/gi,
    "",
  );
  // Remove vendor prefixed animation properties as well
  inner = inner.replaceAll(
    /(?:-webkit-|-moz-|-ms-)?animation-[\w-]+\s*:\s*[^;]+;?/gi,
    "",
  );
  // Replace opacity:0 -> opacity:1 (catch minified and whitespace variants)
  inner = inner.replaceAll(/opacity\s*:\s*0+(?:\.\d+)?\s*;?/gi, "opacity: 1;");
  // Replace visibility:hidden -> visibility:visible
  inner = inner.replaceAll(
    /visibility\s*:\s*hidden\s*;?/gi,
    "visibility: visible;",
  );
  return inner;
}

/**
 * Sanitizes CSS by stripping animation controls, vendor-specific keyframes,
 * and `.stagger` selectors while normalizing opacity/visibility and trimming
 * empty rules.
 * @param css - CSS input to process.
 * @returns Sanitized CSS along with class tokens that were removed.
 * @source
 */
export function sanitizeCssContent(css: string): {
  css: string;
  classesToStrip: string[];
} {
  if (!css?.includes("{")) return { css, classesToStrip: [] };
  // 1) Remove @keyframes via a safe scan. Also remove vendor-prefixed keyframes.
  let sanitized = removeAtRuleBlocks(css, "keyframes");
  sanitized = removeAtRuleBlocks(sanitized, "-webkit-keyframes");
  sanitized = removeAtRuleBlocks(sanitized, "-moz-keyframes");
  sanitized = removeAtRuleBlocks(sanitized, "-ms-keyframes");
  // Lowercase copy for content checks - not needed at the moment
  const classesToStrip = new Set<string>();

  // 2) Parse block-based rules using brace matching (we can reuse existing helpers)
  const blocks = collectCssBlocks(sanitized);

  // Rebuild sanitized CSS by iterating blocks and sanitizing inner content
  let out = "";
  let lastPos = 0;
  for (const b of blocks) {
    out += sanitized.slice(lastPos, b.selectorStart);
    const selectorText = sanitized.slice(b.selectorStart, b.selectorEnd).trim();
    const innerText = sanitized.slice(b.openIdx + 1, b.closeIdx);

    const newInner = removeAnimationPropertiesFromBlock(innerText);
    let newSelectorText = selectorText;

    // If selector list contains `.stagger` and the original innerText had animation-related properties,
    // we will remove `.stagger` from the selector list. We intentionally scope this change
    // to `.stagger` selectors that are used for AniList templates' animations.
    if (/\.stagger\b/i.test(selectorText)) {
      if (/(?:animation\b|animation-\w+\b|animation\s*:)/i.test(innerText)) {
        // remove .stagger token(s) from the selectorList
        const selectors = splitSelectors(selectorText);
        const filtered = selectors.filter(
          (s) => !selectorContainsClass(s, "stagger"),
        );
        if (filtered.length === 0) {
          // Skip the entire rule
          lastPos = b.closeIdx + 1;
          // Mark that we should remove class="stagger" tokens from markup later
          classesToStrip.add("stagger");
          continue;
        }
        newSelectorText = filtered.join(", ");
        // Mark removal from markup if we changed selector list to drop .stagger
        classesToStrip.add("stagger");
      }
    }

    // Append sanitized rule
    out += `${newSelectorText}{${newInner}}`;
    lastPos = b.closeIdx + 1;
  }
  out += sanitized.slice(lastPos);

  // 3) Global cleanup: remove any leftover animation properties or vendor prefixes
  out = out.replaceAll(
    /(?:-webkit-|-moz-|-ms-)?animation(?:-[\w-]+)?\s*:\s*[^;]+;?/gi,
    "",
  );
  out = out.replaceAll(
    /(?:-webkit-|-moz-|-ms-)?animation-[\w-]+\s*:\s*[^;]+;?/gi,
    "",
  );
  // Replace any leftover to blocks (safety)
  out = out.replaceAll(/\bto\s*\{[^}]*\}/gi, "");
  // Normalize opacity/visibility
  out = out.replaceAll(/opacity\s*:\s*0+(?:\.\d+)?\s*;?/gi, "opacity: 1;");
  out = out.replaceAll(
    /visibility\s*:\s*hidden\s*;?/gi,
    "visibility: visible;",
  );

  // 4) Remove empty rules that become empty after our changes
  out = removeEmptyCssRules(out);
  return { css: out, classesToStrip: Array.from(classesToStrip) };
}

export function optimizeSvgMarkup(svgContent: string): {
  svg: string;
  classesToStrip: string[];
} {
  const styleMatch = /<style>([\s\S]*?)<\/style>/.exec(svgContent);
  let cssContent = styleMatch?.[1] || "";
  const { css: sanitizedCss, classesToStrip } = sanitizeCssContent(cssContent);

  if (styleMatch) {
    svgContent =
      svgContent.slice(0, styleMatch.index) +
      `<style>${sanitizedCss}</style>` +
      svgContent.slice(styleMatch.index + styleMatch[0].length);
  }
  svgContent = removeClassTokensFromMarkup(svgContent, classesToStrip);
  svgContent = sanitizeInlineStyleAttributes(svgContent);
  svgContent = svgContent.replaceAll(/\sstyle=(['"])\1/g, "");
  return { svg: svgContent, classesToStrip };
}
