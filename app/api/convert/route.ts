import sharp from "sharp";
import type { NextRequest, NextResponse } from "next/server";
import {
  incrementAnalytics,
  apiJsonHeaders,
  jsonWithCors,
} from "@/lib/api-utils";
import type { ConversionFormat } from "@/lib/utils";

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

/**
 * Removes specific class tokens from single- or double-quoted class attributes.
 * @param svg - SVG markup containing class attributes.
 * @param classTokens - Tokens to strip from class lists.
 * @returns SVG markup without the targeted class tokens.
 * @source
 */
export function removeClassTokensFromMarkup(
  svg: string,
  classTokens: string[],
): string {
  if (!classTokens || classTokens.length === 0) return svg;
  // Replace both single and double-quoted class attributes
  svg = svg.replaceAll(/class=(['"])(.*?)\1/gi, (match, quote, clsValue) => {
    const tokens = clsValue
      .split(/\s+/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const remaining = tokens.filter((t: string) => !classTokens.includes(t));
    if (remaining.length === 0) return ""; // remove entire attribute
    return `class=${quote}${remaining.join(" ")}${quote}`;
  });
  return svg;
}

/**
 * Sanitizes inline style attributes by removing animation properties and
 * normalizing opacity/visibility declarations.
 * @param svg - SVG markup containing inline style attributes.
 * @returns SVG markup with sanitized inline styles.
 * @source
 */
export function sanitizeInlineStyleAttributes(svg: string): string {
  return svg.replaceAll(/style=(['"])(.*?)\1/gi, (m, quote, styleValue) => {
    // Split declarations by semicolon, but tolerate trailing/leading semicolons
    const parts = styleValue
      .split(/;+/)
      .map((p: string) => p.trim())
      .filter(Boolean);
    const outParts: string[] = [];
    for (const p of parts) {
      const [rawName, ...rest] = p.split(":");
      if (!rawName || rest.length === 0) continue;
      const name = rawName.trim().toLowerCase();
      const val = rest.join(":").trim();
      // Skip animation properties and vendor prefixed animation
      if (/^(?:-webkit-|-moz-|-ms-)?animation(?:-.*)?$/i.test(name)) continue;
      let finalVal = val;
      // Normalize opacity
      if (name === "opacity" && /^\s*0+(?:\.\d+)?\s*$/.test(val))
        finalVal = "1";
      // Normalize visibility
      if (name === "visibility" && /^\s*hidden\s*$/i.test(val))
        finalVal = "visible";
      outParts.push(`${name}: ${finalVal}`);
    }
    if (outParts.length === 0) return "";
    return `style=${quote}${outParts.join("; ")}${quote}`;
  });
}

/**
 * Detects whether the hostname represents an IPv4 or IPv6 address.
 * @param hostname - Hostname string to inspect.
 * @returns True when the hostname is a literal IP.
 */
function isIpAddress(hostname: string): boolean {
  return (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // IPv4
    /^\[[0-9a-fA-F:]+\]$/.test(hostname) // IPv6 in brackets
  );
}

/**
 * Checks whether an IPv4 address belongs to private or loopback ranges.
 * @param hostname - Hostname to evaluate.
 */
function isPrivateOrLoopbackIp(hostname: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
  const parts = hostname.split(".").map((x) => Number.parseInt(x, 10));
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

/**
 * Recognizes literal localhost hostnames or IPv6 loopback.
 * @param hostname - Hostname to test.
 */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

/**
 * Sanitizes an SVG by extracting <style> blocks and inline styles, cleaning both,
 * and returning the updated markup and a list of class tokens to strip.
 */
function sanitizeFullSvg(svgContent: string): {
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

/**
 * Determines whether a parsed URL is allowed for conversion given the
 * configured allowed domains and whether we are in development.
 * @returns True when the URL is safe and allowed.
 */
function isUrlAuthorized(
  parsedUrl: URL,
  allowedDomains: string[],
  isDevelopment: boolean,
): boolean {
  const protocolValid = isDevelopment
    ? parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
    : parsedUrl.protocol === "https:";
  if (!allowedDomains.includes(parsedUrl.hostname)) return false;
  if (!protocolValid) return false;
  if (isIpAddress(parsedUrl.hostname) && !isLocalhost(parsedUrl.hostname))
    return false;
  if (
    isPrivateOrLoopbackIp(parsedUrl.hostname) &&
    !isLocalhost(parsedUrl.hostname)
  )
    return false;
  return true;
}

/**
 * Fetches an SVG from the provided URL, returning a NextResponse on failure
 * (so callers can early-return) or the SVG text on success.
 */
async function fetchSvgContent(
  parsedUrl: URL,
  ip: string,
  request: NextRequest,
): Promise<{ errorResponse?: NextResponse; svg?: string }> {
  try {
    const response = await fetch(parsedUrl.href);
    if (!response.ok) {
      incrementAnalytics("analytics:convert_api:failed_requests").catch(
        () => {},
      );
      return {
        errorResponse: jsonWithCors(
          { error: "Failed to fetch SVG" },
          request,
          response.status,
        ),
      };
    }
    const svgText = await response.text();
    return { svg: svgText };
  } catch (err: unknown) {
    console.error("🔴 [Convert API] fetchSvgContent error:", err);
    incrementAnalytics("analytics:convert_api:failed_requests").catch(() => {});
    return {
      errorResponse: jsonWithCors(
        { error: "Failed to fetch SVG" },
        request,
        500,
      ),
    };
  }
}

/**
 * Converts an SVG string into a raster data URL using sharp.
 */
async function convertSvgToDataUrl(
  svg: string,
  requestedFormat: ConversionFormat,
) {
  const transformer = sharp(Buffer.from(svg));
  if (requestedFormat === "webp") transformer.webp({ quality: 90 });
  else transformer.png();
  const convertedBuffer = await transformer.toBuffer();
  const mimeType = requestedFormat === "webp" ? "image/webp" : "image/png";
  return `data:${mimeType};base64,${convertedBuffer.toString("base64")}`;
}

/**
 * Handles POST requests that sanitize SVGs and convert them to PNG data URLs.
 * @param request - Incoming Next.js request with the svgUrl payload.
 * @returns NextResponse containing pngDataUrl on success or an error description.
 * @source
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "unknown IP";
  console.log(`🚀 [Convert API] Request received from ${ip}`);

  try {
    // 1. Parse input and fetch SVG content
    const { svgUrl, format } = await request.json();
    if (!svgUrl) {
      console.warn(`⚠️ [Convert API] Missing 'svgUrl' parameter from ${ip}`);
      incrementAnalytics("analytics:convert_api:failed_requests").catch(
        () => {},
      );
      return jsonWithCors({ error: "Missing svgUrl parameter" }, request, 400);
    }

    const allowedFormats: ConversionFormat[] = ["png", "webp"];
    const normalizedFormat =
      typeof format === "string" ? format.toLowerCase() : "png";
    if (!allowedFormats.includes(normalizedFormat as ConversionFormat)) {
      console.warn(
        `⚠️ [Convert API] Unsupported format '${format}' from ${ip}`,
      );
      // Increment analytics for failed requests to keep metrics consistent
      incrementAnalytics("analytics:convert_api:failed_requests").catch(
        () => {},
      );
      return jsonWithCors({ error: "Invalid format parameter" }, request, 400);
    }
    let requestedFormat = normalizedFormat;

    // Validate the svgUrl
    let parsedUrl;
    try {
      // Handle relative URLs by using the request origin as base
      const baseUrl =
        request.headers.get("origin") ||
        request.headers.get("referer")?.split("?")[0] ||
        `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;
      parsedUrl = new URL(svgUrl, baseUrl);
    } catch {
      console.warn(
        `⚠️ [Convert API] Invalid URL format for 'svgUrl' from ${ip}`,
      );
      return jsonWithCors({ error: "Invalid URL format" }, request, 400);
    }

    const allowedDomains: string[] = [
      ...(process.env.NEXT_PUBLIC_API_URL
        ? [new URL(process.env.NEXT_PUBLIC_API_URL).hostname]
        : []),
    ];
    // In development, allow localhost/127.0.0.1 with HTTP
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      allowedDomains.some(
        (domain) =>
          domain === "localhost" ||
          domain?.startsWith("127.") ||
          domain === "::1",
      );

    if (isDevelopment) {
      allowedDomains.push("localhost", "api.localhost", "127.0.0.1", "::1");
    }

    // In production, require HTTPS. In development, allow HTTP for localhost
    if (!isUrlAuthorized(parsedUrl, allowedDomains, isDevelopment)) {
      console.warn(
        `⚠️ [Convert API] Unauthorized or unsafe domain/protocol in 'svgUrl': ${parsedUrl.href} from ${ip}`,
      );
      return jsonWithCors(
        { error: "Unauthorized or unsafe domain/protocol" },
        request,
        403,
      );
    }

    // In development, normalize api.localhost to localhost for DNS resolution
    if (isDevelopment && parsedUrl.hostname === "api.localhost") {
      parsedUrl.hostname = "localhost";
    }

    console.log(`🔍 [Convert API] Fetching SVG from: ${parsedUrl.href}`);
    const fetched = await fetchSvgContent(parsedUrl, ip, request);
    if (fetched.errorResponse) return fetched.errorResponse;
    let svgContent = fetched.svg || "";
    console.log(
      `📝 [Convert API] Received SVG content (${svgContent.length} characters)`,
    );

    // 1. Extract and sanitize CSS style blocks
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    const { svg: sanitizedSvg } = sanitizeFullSvg(svgContent);
    svgContent = sanitizedSvg;
    console.log("🧼 [Convert API] Final SVG cleanup completed.");

    // 4. Convert the processed SVG to the requested raster format using sharp
    console.log(
      `🔄 [Convert API] Converting SVG to ${requestedFormat.toUpperCase()} using sharp...`,
    );
    const pngDataUrl = await convertSvgToDataUrl(
      svgContent,
      requestedFormat as ConversionFormat,
    );
    const conversionDuration = Date.now() - startTime;
    console.log(
      `✅ [Convert API] SVG converted to ${requestedFormat.toUpperCase()} successfully in ${conversionDuration}ms`,
    );
    incrementAnalytics("analytics:convert_api:successful_requests").catch(
      () => {},
    );
    return jsonWithCors({ pngDataUrl }, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    console.error(
      `🔥 [Convert API] Conversion error after ${errorDuration}ms: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [Convert API] Stack Trace: ${error.stack}`);
    }
    incrementAnalytics("analytics:convert_api:failed_requests").catch(() => {});
    return jsonWithCors({ error: "Conversion failed" }, request, 500);
  }
}

export function OPTIONS(request: NextRequest) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
