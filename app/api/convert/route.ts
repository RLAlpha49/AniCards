import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { incrementAnalytics } from "@/lib/api-utils";

/**
 * Safely removes empty CSS rules from a CSS string. This function parses the CSS
 * text while respecting quotes and comments, finds block pairs `{}` and removes
 * those which contain only whitespace/comments.
 *
 * This protects against catastrophic backtracking by avoiding vulnerable regexes
 * that have unbounded backtracking (e.g. /...+\{\s*\}/).
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

function advanceIndexPastEndOfComment(input: string, start: number): number {
  // start points to '/' and next is '*'
  let j = start + 2;
  while (j < input.length) {
    if (input[j] === "*" && input[j + 1] === "/") return j + 2; // position after '*/'
    j += 1;
  }
  return j;
}

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
 * Find the index after the matching closing brace '}' starting from the openIdx
 * which points at the opening '{'. This function respects quoted strings and
 * comment blocks so that braces inside them don't affect the depth count.
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
 * Find index of the opening brace '{' after a start index while skipping
 * comments and quoted strings. Returns index of '{' or input.length if not found.
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

function findEmptyCssRanges(input: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const stack: number[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const nxt = input[i + 1];
    // Skip comments
    if (ch === "/" && nxt === "*") {
      i = advanceIndexPastEndOfComment(input, i);
      continue;
    }
    // Skip single-quoted strings
    if (ch === "'") {
      i = advanceIndexPastEndOfQuote(input, i, "'");
      continue;
    }
    // Skip double-quoted strings
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
      i = handleClosingBrace(input, stack, i, ranges);
      continue;
    }
    i += 1;
  }
  return ranges;
}

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

function handleClosingBrace(
  input: string,
  stack: number[],
  i: number,
  ranges: Array<[number, number]>,
): number {
  if (stack.length === 0) return i + 1;
  const openIdx = stack.pop()!;
  const inner = input.slice(openIdx + 1, i);
  if (isWhitespaceOrComments(inner)) {
    const start = findSelectorStart(input, openIdx);
    ranges.push([start, i + 1]);
  }
  return i + 1;
}

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
 * Extract the first <style> tag in the SVG and return its indices and inner CSS.
 * Returns null if not found.
 */
function extractStyleTag(
  svg: string,
): { start: number; end: number; css: string } | null {
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/i;
  const match = re.exec(svg);
  if (!match) return null;
  const start = match.index;
  const end = start + match[0].length;
  const css = match[1];
  return { start, end, css };
}

/**
 * Remove any at-rule blocks (e.g., @keyframes) found in CSS by name.
 * Uses a brace-balanced scan so it survives minified and nested content.
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
 * Split a selector list by commas while ignoring commas that are inside parentheses
 * (for example, :nth-child selectors). Returns trimmed selectors.
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
 * Remove animation properties such as `animation` shorthand and `animation-*` prefixed
 * properties from a CSS block. Also normalizes opacity and visibility to avoid
 * hidden elements.
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
 * Sanitizes a CSS string policy-wise:
 * - Removes @keyframes blocks
 * - Removes animation-related declarations
 * - Rewrites opacity/visibility
 * - Removes `.stagger` selectors if the associated rule contains animation
 */
/**
 * sanitizeCssContent - policy-driven CSS sanitizer
 *
 * Policy:
 * - Remove animation controls entirely: any 'animation' shorthand and
 *   any 'animation-*' properties (including vendor-prefixed variants).
 * - Remove @keyframes blocks (including vendor-prefixed variants).
 * - Normalize 'opacity: 0' to 'opacity: 1' to avoid hidden elements.
 * - Normalize 'visibility: hidden' to 'visibility: visible'.
 * - Remove '.stagger' selectors only when their rule contains animation
 *   properties, and then remove 'stagger' class tokens from markup. This
 *   change is conservative to avoid removing user-defined classes with the
 *   same name unless they were used for animations.
 * - Remove empty rules after sanitization.
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
 * Remove class tokens from class attributes (both single and double quoted).
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
 * Sanitize inline style attributes within the SVG markup. This preserves
 * unrelated style declarations while stripping `animation*` related ones
 * and normalizing opacity/visibility.
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

// API endpoint for converting SVG to PNG with style fixes
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "unknown IP";
  console.log(`🚀 [Convert API] Request received from ${ip}`);

  try {
    // 1. Parse input and fetch SVG content
    const { svgUrl } = await request.json();
    if (!svgUrl) {
      console.warn(`⚠️ [Convert API] Missing 'svgUrl' parameter from ${ip}`);
      incrementAnalytics("analytics:convert_api:failed_requests").catch(
        () => {},
      );
      return NextResponse.json(
        { error: "Missing svgUrl parameter" },
        { status: 400 },
      );
    }

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
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
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

    // SSRF protection: Only allow listed domains and HTTPS (HTTP allowed in dev), disallow any local/loopback/private IP addresses
    function isIpAddress(hostname: string): boolean {
      // Detect IPv4 and IPv6 addresses
      return (
        /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // IPv4
        /^\[[0-9a-fA-F:]+\]$/.test(hostname) // IPv6 in brackets
      );
    }
    // Check for private IP address ranges (e.g., 10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    function isPrivateOrLoopbackIp(hostname: string): boolean {
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
      const parts = hostname.split(".").map((x) => Number.parseInt(x, 10));
      if (parts[0] === 10) return true;
      if (parts[0] === 127) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      return false;
    }
    // Check if hostname is localhost or IPv6 loopback
    function isLocalhost(hostname: string): boolean {
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"
      );
    }

    // In production, require HTTPS. In development, allow HTTP for localhost
    const protocolValid = isDevelopment
      ? parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
      : parsedUrl.protocol === "https:";

    if (
      !allowedDomains.includes(parsedUrl.hostname) ||
      !protocolValid ||
      (isIpAddress(parsedUrl.hostname) && !isLocalhost(parsedUrl.hostname)) ||
      (isPrivateOrLoopbackIp(parsedUrl.hostname) &&
        !isLocalhost(parsedUrl.hostname))
    ) {
      console.warn(
        `⚠️ [Convert API] Unauthorized or unsafe domain/protocol in 'svgUrl': ${parsedUrl.href} from ${ip}`,
      );
      return NextResponse.json(
        { error: "Unauthorized or unsafe domain/protocol" },
        { status: 403 },
      );
    }

    console.log(`🔍 [Convert API] Fetching SVG from: ${parsedUrl.href}`);
    const response = await fetch(parsedUrl.href);
    if (!response.ok) {
      console.error(
        `🔥 [Convert API] Failed to fetch SVG. HTTP status: ${response.status}`,
      );
      incrementAnalytics("analytics:convert_api:failed_requests").catch(
        () => {},
      );
      return NextResponse.json(
        { error: "Failed to fetch SVG" },
        { status: response.status },
      );
    }
    let svgContent = await response.text();
    console.log(
      `📝 [Convert API] Received SVG content (${svgContent.length} characters)`,
    );

    // 1. Extract and sanitize CSS style blocks
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    const styleMatch = new RegExp(/<style>([\s\S]*?)<\/style>/).exec(
      svgContent,
    );
    let cssContent = styleMatch?.[1] || "";
    const { css: sanitizedCss, classesToStrip } =
      sanitizeCssContent(cssContent);

    // Remove/replace the <style> tag only if it exists
    // Rebuild SVG with processed styles
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    if (styleMatch) {
      svgContent =
        svgContent.slice(0, styleMatch.index) +
        `<style>${sanitizedCss}</style>` +
        svgContent.slice(styleMatch.index + styleMatch[0].length);
    }
    console.log("🖌️  [Convert API] CSS styles normalized.");
    // 2. Remove class tokens from markup according to sanitized CSS rules
    svgContent = removeClassTokensFromMarkup(svgContent, classesToStrip);
    // 3. Sanitize inline style attributes (remove animation declarations and normalize opacity/visibility)
    svgContent = sanitizeInlineStyleAttributes(svgContent);
    // 4. Remove trivial cruft such as empty style attributes
    svgContent = svgContent.replaceAll(/\sstyle=(['"])\1/g, "");
    console.log("🧼 [Convert API] Final SVG cleanup completed.");

    // 4. Convert the processed SVG to PNG using sharp
    console.log("🔄 [Convert API] Converting SVG to PNG using sharp...");
    const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const conversionDuration = Date.now() - startTime;
    console.log(
      `✅ [Convert API] SVG converted to PNG successfully in ${conversionDuration}ms`,
    );
    incrementAnalytics("analytics:convert_api:successful_requests").catch(
      () => {},
    );
    return NextResponse.json({ pngDataUrl });
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
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}
