/**
 * Sanitizes trusted AniCards SVG output before raster conversion.
 *
 * The conversion endpoint accepts SVG URLs from allow-listed origins only, then
 * strips animations and brittle style fragments before handing the markup to
 * `sharp`. That keeps exported PNG/WebP images stable across templates while
 * reducing SSRF risk and renderer-specific SVG edge cases.
 */
import type { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { readJsonRequestBody } from "@/lib/api/request-body";
import { initializeApiRequest } from "@/lib/api/request-guards";
import {
  scheduleAnalyticsIncrement,
  scheduleLowValueAnalyticsIncrement,
} from "@/lib/api/telemetry";
import {
  fetchUpstreamWithRetry,
  UpstreamTransportError,
} from "@/lib/api/upstream";
import type { ConversionFormat } from "@/lib/utils";

const ratelimit = createRateLimiter({
  limit: 20,
  window: "1 m",
  hotPath: true,
});
const CONVERT_JSON_BODY_LIMIT_BYTES = 1_250_000;
const SVG_FETCH_TIMEOUT_MS = 5_000;
const SVG_MAX_BYTES = 1_000_000;
const SVG_MAX_DIMENSION_PX = 4_096;
const SVG_MAX_RASTER_PIXELS = 16_777_216;
const CONVERT_API_ENDPOINT = "Convert API";
const CONVERT_API_FAILED_METRIC = "analytics:convert_api:failed_requests";
const CONVERT_API_SUCCESS_METRIC = "analytics:convert_api:successful_requests";

type ConvertResponseMode = "binary" | "json";

class ConvertRouteError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ConvertRouteError";
    this.statusCode = statusCode;
  }
}

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
      if (ch === "*" && nxt === "/") {
        inComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === "/" && nxt === "*") {
      inComment = true;
      i += 2;
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
  let j = start + 2;
  while (j < input.length) {
    if (input[j] === "*" && input[j + 1] === "/") return j + 2;
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
    if (input[j] === quote && input[j - 1] !== "\\") return j + 1;
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
    if (ch === "/" && nxt === "*") {
      i = advanceIndexPastEndOfComment(input, i);
      continue;
    }
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
    out += inputCss.slice(i, idx);
    const j = findOpeningBraceIndex(inputCss, idx);
    if (j >= inputCss.length) break; // malformed at-rule without block
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
  let sanitized = removeAtRuleBlocks(css, "keyframes");
  sanitized = removeAtRuleBlocks(sanitized, "-webkit-keyframes");
  sanitized = removeAtRuleBlocks(sanitized, "-moz-keyframes");
  sanitized = removeAtRuleBlocks(sanitized, "-ms-keyframes");
  const classesToStrip = new Set<string>();
  const blocks = collectCssBlocks(sanitized);
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
        const selectors = splitSelectors(selectorText);
        const filtered = selectors.filter(
          (s) => !selectorContainsClass(s, "stagger"),
        );
        if (filtered.length === 0) {
          lastPos = b.closeIdx + 1;
          classesToStrip.add("stagger");
          continue;
        }
        newSelectorText = filtered.join(", ");
        classesToStrip.add("stagger");
      }
    }
    out += `${newSelectorText}{${newInner}}`;
    lastPos = b.closeIdx + 1;
  }
  out += sanitized.slice(lastPos);
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
  out = out.replaceAll(/opacity\s*:\s*0+(?:\.\d+)?\s*;?/gi, "opacity: 1;");
  out = out.replaceAll(
    /visibility\s*:\s*hidden\s*;?/gi,
    "visibility: visible;",
  );
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
  svg = svg.replaceAll(/class=(['"])(.*?)\1/gi, (match, quote, clsValue) => {
    const tokens = clsValue
      .split(/\s+/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const remaining = tokens.filter((t: string) => !classTokens.includes(t));
    if (remaining.length === 0) return "";
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
      if (/^(?:-webkit-|-moz-|-ms-)?animation(?:-.*)?$/i.test(name)) continue;
      let finalVal = val;
      if (name === "opacity" && /^\s*0+(?:\.\d+)?\s*$/.test(val))
        finalVal = "1";
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

function isAllowedSvgContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mimeType = contentType.split(";")[0]?.trim().toLowerCase();
  return [
    "image/svg+xml",
    "text/plain",
    "application/xml",
    "text/xml",
  ].includes(mimeType);
}

function looksLikeSvgDocument(content: string): boolean {
  return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/i.test(content);
}

async function readTextResponseWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ConvertRouteError("SVG response too large", 413);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new ConvertRouteError("SVG response too large", 413);
    }
    return text;
  }

  const decoder = new TextDecoder();
  let totalBytes = 0;
  let svgContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new ConvertRouteError("SVG response too large", 413);
    }

    svgContent += decoder.decode(value, { stream: true });
  }

  svgContent += decoder.decode();
  return svgContent;
}

function parseSvgLength(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/i.exec(value);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getAllowedConvertDomains(): {
  allowedDomains: string[];
  isDevelopment: boolean;
} {
  const allowedDomains: string[] = [
    ...(process.env.NEXT_PUBLIC_API_URL
      ? [new URL(process.env.NEXT_PUBLIC_API_URL).hostname]
      : []),
  ];
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

  return { allowedDomains, isDevelopment };
}

function normalizeSvgUrl(svgUrl: unknown): string | undefined {
  return typeof svgUrl === "string" && svgUrl.trim() ? svgUrl : undefined;
}

function normalizeInlineSvgContent(svgContent: unknown): string | undefined {
  if (typeof svgContent !== "string" || !svgContent.trim()) {
    return undefined;
  }

  if (Buffer.byteLength(svgContent, "utf8") > SVG_MAX_BYTES) {
    throw new ConvertRouteError("SVG response too large", 413);
  }

  if (!looksLikeSvgDocument(svgContent)) {
    throw new ConvertRouteError("Provided content is not a valid SVG", 415);
  }

  return svgContent;
}

function parseRequestedFormat(format: unknown): ConversionFormat {
  const allowedFormats: ConversionFormat[] = ["png", "webp"];
  const normalizedFormat =
    typeof format === "string" ? format.toLowerCase() : "png";

  if (!allowedFormats.includes(normalizedFormat as ConversionFormat)) {
    throw new ConvertRouteError("Invalid format parameter", 400);
  }

  return normalizedFormat as ConversionFormat;
}

function parseResponseMode(responseType: unknown): ConvertResponseMode {
  if (typeof responseType === "undefined") {
    return "binary";
  }

  if (responseType === "json" || responseType === "binary") {
    return responseType;
  }

  throw new ConvertRouteError("Invalid responseType parameter", 400);
}

function parseSvgRequestBody(body: unknown): {
  responseMode: ConvertResponseMode;
  requestedFormat: ConversionFormat;
  svgContent?: string;
  svgUrl?: string;
} {
  const parsedBody =
    typeof body === "object" && body !== null
      ? (body as {
          format?: unknown;
          responseType?: unknown;
          svgContent?: unknown;
          svgUrl?: unknown;
        })
      : undefined;
  const svgUrl = parsedBody?.svgUrl;
  const svgContent = parsedBody?.svgContent;
  const format = parsedBody?.format;
  const responseType = parsedBody?.responseType;

  const normalizedSvgUrl = normalizeSvgUrl(svgUrl);
  const normalizedSvgContent = normalizeInlineSvgContent(svgContent);

  if (!normalizedSvgUrl && !normalizedSvgContent) {
    throw new ConvertRouteError("Missing svgUrl or svgContent parameter", 400);
  }

  return {
    requestedFormat: parseRequestedFormat(format),
    responseMode: parseResponseMode(responseType),
    ...(normalizedSvgUrl ? { svgUrl: normalizedSvgUrl } : {}),
    ...(normalizedSvgContent ? { svgContent: normalizedSvgContent } : {}),
  };
}

function parseSvgTargetUrl(request: NextRequest, svgUrl: string): URL {
  try {
    const baseUrl =
      request.headers.get("origin") ||
      request.headers.get("referer")?.split("?")[0] ||
      `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;
    return new URL(svgUrl, baseUrl);
  } catch {
    throw new ConvertRouteError("Invalid URL format", 400);
  }
}

function validateSvgTargetUrl(parsedUrl: URL): URL {
  const { allowedDomains, isDevelopment } = getAllowedConvertDomains();

  if (!isUrlAuthorized(parsedUrl, allowedDomains, isDevelopment)) {
    throw new ConvertRouteError("Unauthorized or unsafe domain/protocol", 403);
  }

  if (isDevelopment && parsedUrl.hostname === "api.localhost") {
    parsedUrl.hostname = "localhost";
  }

  const normalizedPath = parsedUrl.pathname.toLowerCase();
  const isAniCardsCardRoute =
    normalizedPath === "/api/card" || normalizedPath === "/api/card.svg";
  const isLegacyStatCardRoute =
    normalizedPath.includes("/statcards/") && normalizedPath.endsWith(".svg");

  if (
    (isAniCardsCardRoute || isLegacyStatCardRoute) &&
    !parsedUrl.searchParams.has("animate")
  ) {
    parsedUrl.searchParams.set("animate", "false");
  }

  return parsedUrl;
}

function createConvertErrorResponse(
  error: ConvertRouteError,
  request: NextRequest,
  endpoint: string,
): NextResponse {
  logPrivacySafe(
    error.statusCode >= 500 ? "error" : "warn",
    endpoint,
    "Conversion rejected",
    {
      statusCode: error.statusCode,
      error: error.message,
    },
    request,
  );
  const scheduleMetric =
    error.statusCode >= 500
      ? scheduleAnalyticsIncrement
      : scheduleLowValueAnalyticsIncrement;
  scheduleMetric(CONVERT_API_FAILED_METRIC, {
    endpoint,
    request,
    taskName: CONVERT_API_FAILED_METRIC,
  });
  return apiErrorResponse(request, error.statusCode, error.message);
}

function validateSvgRasterizationBounds(svg: string): void {
  const svgTagMatch = /<svg\b([^>]*)>/i.exec(svg);
  const attributes = svgTagMatch?.[1] ?? "";
  const width = parseSvgLength(
    /\bwidth=(['"])(.*?)\1/i.exec(attributes)?.[2] ?? null,
  );
  const height = parseSvgLength(
    /\bheight=(['"])(.*?)\1/i.exec(attributes)?.[2] ?? null,
  );
  const viewBoxMatch = /\bviewBox=(['"])(.*?)\1/i.exec(attributes);
  const viewBoxParts = viewBoxMatch?.[2]
    ?.trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
  const viewBoxWidth =
    viewBoxParts?.length === 4 && Number.isFinite(viewBoxParts[2])
      ? Math.abs(viewBoxParts[2])
      : undefined;
  const viewBoxHeight =
    viewBoxParts?.length === 4 && Number.isFinite(viewBoxParts[3])
      ? Math.abs(viewBoxParts[3])
      : undefined;

  const effectiveWidth = width ?? viewBoxWidth;
  const effectiveHeight = height ?? viewBoxHeight;

  if (
    typeof effectiveWidth === "number" &&
    typeof effectiveHeight === "number" &&
    effectiveWidth * effectiveHeight > SVG_MAX_RASTER_PIXELS
  ) {
    throw new ConvertRouteError("SVG rasterization exceeds pixel limits", 413);
  }

  if (
    (typeof effectiveWidth === "number" &&
      effectiveWidth > SVG_MAX_DIMENSION_PX) ||
    (typeof effectiveHeight === "number" &&
      effectiveHeight > SVG_MAX_DIMENSION_PX)
  ) {
    throw new ConvertRouteError(
      "SVG rasterization exceeds dimension limits",
      413,
    );
  }
}

/**
 * Sanitizes an SVG by extracting <style> blocks and inline styles, cleaning both,
 * and returning the updated markup and a list of class tokens to strip.
 */
function sanitizeFullSvg(svgContent: string): {
  svg: string;
  classesToStrip: string[];
} {
  const classesToStrip = new Set<string>();

  svgContent = svgContent.replaceAll(
    /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
    (_match, attributes, cssContent) => {
      const { css: sanitizedCss, classesToStrip: cssClassesToStrip } =
        sanitizeCssContent(cssContent);
      for (const className of cssClassesToStrip) {
        classesToStrip.add(className);
      }

      return `<style${attributes}>${sanitizedCss}</style>`;
    },
  );

  const classesToRemove = Array.from(classesToStrip);
  svgContent = removeClassTokensFromMarkup(svgContent, classesToRemove);
  svgContent = sanitizeInlineStyleAttributes(svgContent);
  svgContent = svgContent.replaceAll(/\sstyle=(['"])\1/g, "");
  return { svg: svgContent, classesToStrip: classesToRemove };
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

function recordConvertFailureMetric(
  request: NextRequest,
  options?: {
    endpoint?: string;
    lowValue?: boolean;
  },
): void {
  const scheduleMetric = options?.lowValue
    ? scheduleLowValueAnalyticsIncrement
    : scheduleAnalyticsIncrement;

  scheduleMetric(CONVERT_API_FAILED_METRIC, {
    endpoint: options?.endpoint ?? CONVERT_API_ENDPOINT,
    request,
    taskName: CONVERT_API_FAILED_METRIC,
  });
}

function createSvgFetchErrorResponse(
  request: NextRequest,
  status: number,
  message: string,
  options?: {
    category?: "invalid_data";
    retryable?: boolean;
    headers?: Record<string, string>;
  },
): { errorResponse: NextResponse } {
  recordConvertFailureMetric(request, {
    lowValue: true,
  });
  return {
    errorResponse: apiErrorResponse(request, status, message, {
      headers: options?.headers,
      category: options?.category,
      retryable: options?.retryable,
    }),
  };
}

async function readValidatedSvgResponse(
  response: Response,
  request: NextRequest,
): Promise<{ errorResponse?: NextResponse; svg?: string }> {
  if (response.status >= 300 && response.status < 400) {
    return createSvgFetchErrorResponse(
      request,
      403,
      "SVG redirects are not allowed",
      {
        category: "invalid_data",
        retryable: false,
      },
    );
  }

  if (!response.ok) {
    return createSvgFetchErrorResponse(
      request,
      response.status,
      "Failed to fetch SVG",
    );
  }

  const contentType = response.headers.get("content-type");
  const svgText = await readTextResponseWithLimit(response, SVG_MAX_BYTES);
  if (!isAllowedSvgContentType(contentType) || !looksLikeSvgDocument(svgText)) {
    return createSvgFetchErrorResponse(
      request,
      415,
      "Fetched content is not a valid SVG",
      {
        category: "invalid_data",
        retryable: false,
      },
    );
  }

  return { svg: svgText };
}

function handleFetchSvgContentError(
  err: unknown,
  request: NextRequest,
): { errorResponse: NextResponse } {
  logPrivacySafe(
    "error",
    "Convert API",
    "SVG fetch failed",
    {
      error: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    },
    request,
  );
  recordConvertFailureMetric(request, {
    lowValue: err instanceof ConvertRouteError,
  });

  if (err instanceof ConvertRouteError) {
    return {
      errorResponse: apiErrorResponse(request, err.statusCode, err.message),
    };
  }

  if (err instanceof UpstreamTransportError) {
    return {
      errorResponse: apiErrorResponse(
        request,
        err.statusCode,
        err.statusCode === 504 ? "SVG fetch timed out" : "Failed to fetch SVG",
        {
          headers:
            typeof err.retryAfterMs === "number"
              ? {
                  "Retry-After": String(
                    Math.max(1, Math.ceil(err.retryAfterMs / 1000)),
                  ),
                }
              : undefined,
        },
      ),
    };
  }

  return {
    errorResponse: apiErrorResponse(request, 500, "Failed to fetch SVG"),
  };
}

/**
 * Fetches an SVG from the provided URL, returning a NextResponse on failure
 * (so callers can early-return) or the SVG text on success.
 */
async function fetchSvgContent(
  parsedUrl: URL,
  request: NextRequest,
): Promise<{ errorResponse?: NextResponse; svg?: string }> {
  try {
    const response = await fetchUpstreamWithRetry({
      service: "SVG Fetch",
      url: parsedUrl.href,
      init: {
        headers: {
          Accept:
            "image/svg+xml,text/plain;q=0.9,application/xml;q=0.8,text/xml;q=0.7",
        },
        redirect: "manual",
      },
      timeoutMs: SVG_FETCH_TIMEOUT_MS,
      maxAttempts: 1,
      circuitBreaker: false,
    });

    return readValidatedSvgResponse(response, request);
  } catch (err: unknown) {
    return handleFetchSvgContentError(err, request);
  }
}

/**
 * Converts an SVG string into a raster data URL using sharp.
 */
async function convertSvgToRaster(
  svg: string,
  requestedFormat: ConversionFormat,
): Promise<{ convertedBuffer: Buffer; mimeType: string }> {
  validateSvgRasterizationBounds(svg);

  const inputBuffer = Buffer.from(svg);
  const sourceImage = sharp(inputBuffer, {
    limitInputPixels: SVG_MAX_RASTER_PIXELS,
  });
  const metadata = await sourceImage.metadata();

  if (
    (metadata.width && metadata.width > SVG_MAX_DIMENSION_PX) ||
    (metadata.height && metadata.height > SVG_MAX_DIMENSION_PX)
  ) {
    throw new ConvertRouteError(
      "SVG rasterization exceeds dimension limits",
      413,
    );
  }

  if (
    metadata.width &&
    metadata.height &&
    metadata.width * metadata.height > SVG_MAX_RASTER_PIXELS
  ) {
    throw new ConvertRouteError("SVG rasterization exceeds pixel limits", 413);
  }

  const transformer = sourceImage.clone();
  if (requestedFormat === "webp") transformer.webp({ quality: 90 });
  else transformer.png();
  const convertedBuffer = await transformer.toBuffer();
  const mimeType = requestedFormat === "webp" ? "image/webp" : "image/png";
  return { convertedBuffer, mimeType };
}

function encodeRasterDataUrl(
  convertedBuffer: Buffer,
  mimeType: string,
): string {
  return `data:${mimeType};base64,${convertedBuffer.toString("base64")}`;
}

type ConvertJsonResponse = {
  format: ConversionFormat;
  imageDataUrl: string;
};

function binaryWithCors(
  body: Uint8Array | Buffer,
  mimeType: string,
  request: NextRequest,
): Response {
  const responseBody = Uint8Array.from(body);

  return new Response(responseBody, {
    headers: {
      ...apiJsonHeaders(request),
      "Content-Type": mimeType,
    },
  });
}

/**
 * Handles POST requests that sanitize SVGs and convert them to raster outputs.
 * @param request - Incoming Next.js request with the svgUrl payload.
 * @returns JSON data URL or binary image output on success, or an error description.
 * @source
 */
export async function POST(request: NextRequest) {
  const init = await initializeApiRequest(
    request,
    CONVERT_API_ENDPOINT,
    "convert_api",
    ratelimit,
    {
      requireRequestProof: true,
      requireVerifiedClientIp: true,
      skipSameOrigin: true,
    },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint, endpointKey, ip } = init;

  logPrivacySafe("log", endpoint, "Request received", { ip }, request);

  try {
    const bodyResult = await readJsonRequestBody<unknown>(request, {
      endpointName: endpoint,
      endpointKey,
      maxBytes: CONVERT_JSON_BODY_LIMIT_BYTES,
    });
    if (!bodyResult.success) return bodyResult.errorResponse;

    const requestBody = bodyResult.data;

    const { requestedFormat, responseMode, svgContent, svgUrl } =
      parseSvgRequestBody(requestBody);
    let resolvedSvgContent = svgContent || "";

    if (resolvedSvgContent) {
      logPrivacySafe(
        "log",
        endpoint,
        "Received inline SVG content",
        { svgLength: resolvedSvgContent.length },
        request,
      );
    } else {
      const parsedUrl = validateSvgTargetUrl(
        parseSvgTargetUrl(request, svgUrl || ""),
      );

      logPrivacySafe(
        "log",
        endpoint,
        "Fetching SVG from URL",
        { svgUrl: parsedUrl.href },
        request,
      );
      const fetched = await fetchSvgContent(parsedUrl, request);
      if (fetched.errorResponse) return fetched.errorResponse;
      resolvedSvgContent = fetched.svg || "";
      logPrivacySafe(
        "log",
        endpoint,
        "Received remote SVG content",
        { svgLength: resolvedSvgContent.length },
        request,
      );
    }

    const { svg: sanitizedSvg } = sanitizeFullSvg(resolvedSvgContent);
    resolvedSvgContent = sanitizedSvg;
    logPrivacySafe(
      "log",
      endpoint,
      "Final SVG cleanup completed",
      undefined,
      request,
    );

    logPrivacySafe(
      "log",
      endpoint,
      "Converting SVG to raster",
      { requestedFormat },
      request,
    );
    const { convertedBuffer, mimeType } = await convertSvgToRaster(
      resolvedSvgContent,
      requestedFormat,
    );
    const conversionDuration = Date.now() - startTime;
    logPrivacySafe(
      "log",
      endpoint,
      "SVG converted successfully",
      { requestedFormat, durationMs: conversionDuration },
      request,
    );
    scheduleAnalyticsIncrement(CONVERT_API_SUCCESS_METRIC, {
      endpoint,
      request,
      taskName: CONVERT_API_SUCCESS_METRIC,
    });

    if (responseMode === "binary") {
      return binaryWithCors(convertedBuffer, mimeType, request);
    }

    const responseBody: ConvertJsonResponse = {
      format: requestedFormat,
      imageDataUrl: encodeRasterDataUrl(convertedBuffer, mimeType),
    };

    return jsonWithCors(responseBody, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof ConvertRouteError) {
      return createConvertErrorResponse(error, request, endpoint);
    }

    return handleError(
      error as Error,
      endpoint,
      startTime,
      CONVERT_API_FAILED_METRIC,
      "Conversion failed",
      request,
    );
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
