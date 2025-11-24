import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

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
  for (let i = 0; i < substr.length; i++) {
    const ch = substr[i];
    const nxt = substr[i + 1];
    if (inComment) {
      if (ch === "*" && nxt === "/") {
        inComment = false;
        i += 1; // skip '/'
      }
      continue;
    }
    if (ch === "/" && nxt === "*") {
      inComment = true;
      i += 1; // skip '*'
      continue;
    }
    if (!/\s/.test(ch)) return false;
  }
  return !inComment;
}

function removeEmptyCssBlocksOnce(input: string): { css: string; removed: boolean } {
  const stack: number[] = [];
  const rangesToRemove: Array<[number, number]> = [];
  let inSingle = false;
  let inDouble = false;
  let inComment = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const nxt = input[i + 1];
    if (inComment) {
      if (ch === "*" && nxt === "/") {
        inComment = false;
        i += 2; // skip '*/'
        continue;
      }
      i += 1;
      continue;
    }
    if (inSingle) {
      if (ch === "'" && input[i - 1] !== "\\") inSingle = false;
      i += 1;
      continue;
    }
    if (inDouble) {
      if (ch === '"' && input[i - 1] !== "\\") inDouble = false;
      i += 1;
      continue;
    }
    if (ch === "/" && nxt === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i += 1;
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
        continue; // unmatched closing brace - ignore
      }
      const openIdx = stack.pop()!;
      const inner = input.slice(openIdx + 1, i);
      if (isWhitespaceOrComments(inner)) {
        // Find selector start: walk backwards skipping whitespace until we hit
        // a '}', '{', or ';' (these delimit rules) or beginning of string.
        let start = openIdx - 1;
        while (start >= 0 && /\s/.test(input[start])) start -= 1;
        while (start >= 0 && input[start] !== "}" && input[start] !== "{" && input[start] !== ";") {
          start -= 1;
        }
        rangesToRemove.push([start + 1, i + 1]);
      }
      i += 1;
      continue;
    }
    i += 1;
  }

  if (rangesToRemove.length === 0) return { css: input, removed: false };
  rangesToRemove.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of rangesToRemove) {
    if (merged.length === 0) merged.push(r);
    else {
      const lastR = merged[merged.length - 1];
      if (r[0] <= lastR[1]) lastR[1] = Math.max(lastR[1], r[1]);
      else merged.push(r);
    }
  }
  let out = "";
  let pos = 0;
  for (const [s, e] of merged) {
    out += input.slice(pos, s);
    pos = e;
  }
  out += input.slice(pos);
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
      const analyticsClient = Redis.fromEnv();
      analyticsClient
        .incr("analytics:convert_api:failed_requests")
        .catch(() => {});
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
          domain === "localhost" || domain?.startsWith("127.") || domain === "::1",
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
      (isPrivateOrLoopbackIp(parsedUrl.hostname) && !isLocalhost(parsedUrl.hostname))
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
      const analyticsClient = Redis.fromEnv();
      analyticsClient
        .incr("analytics:convert_api:failed_requests")
        .catch(() => {});
      return NextResponse.json(
        { error: "Failed to fetch SVG" },
        { status: response.status },
      );
    }
    let svgContent = await response.text();
    console.log(
      `📝 [Convert API] Received SVG content (${svgContent.length} characters)`,
    );

    // 1. Remove animation artifacts
    svgContent = svgContent
      // Regex explanation:
      // - opacity: 0;? matches opacity: 0;
      // - Replace all opacity: 0 declarations with 1
      .replaceAll(/opacity:\s*0;?/g, "opacity: 1;")
      // Regex explanation:
      // - \.stagger matches the CSS class name
      // - {[^}]*} matches everything between curly braces
      // Remove entire .stagger CSS blocks
      .replaceAll(/\.stagger\s*{[^}]*}/g, "")
      // Regex explanation:
      // - class="stagger" matches class="stagger"
      // Replace all class="stagger" attributes with an empty string
      .replaceAll('class="stagger"', "");
    console.log("🧹 [Convert API] Removed animation artifacts.");

    // 2. Process CSS styles
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    const styleMatch = new RegExp(/<style>([\s\S]*?)<\/style>/).exec(svgContent);
    let cssContent = styleMatch?.[1] || "";
    cssContent = cssContent
      // Regex explanation:
      // - @keyframes\s+\w+\s*{[^}]*} matches @keyframes blocks
      // - \s+\w+ matches the animation name
      // - {[^}]*} matches everything between curly braces
      .replaceAll(/@keyframes\s+\w+\s*{[^}]*}/g, "")
      // Regex explanation:
      // - animation:\s*[^;]+;? matches animation properties
      // - Remove animation properties
      .replaceAll(/animation:\s*[^;]+;?/g, "")
      // Regex explanation:
      // - } matches the closing brace
      // - \s*to\s* matches optional whitespace followed by "to"
      // - {[^}]*} matches everything between curly braces
      // Remove orphaned to-blocks
      .replaceAll(/}\s*to\s*{[^}]*}/g, "")
      // Regex explanation:
      // - to\s* matches optional whitespace followed by "to"
      // - {[^}]*} matches everything between curly braces
      .replaceAll(/to\s*{[^}]*}/g, "")
      // Regex explanation:
      // - opacity:\s*1;\.(\d+); matches opacity values with 1 and a decimal point
      // - Replace with opacity: 0. followed by the captured decimal
      .replaceAll(/opacity:\s*1;\.(\d+);/g, "opacity: 0.$1;")
      // Regex explanation:
      // - opacity:\s*0 matches opacity: 0
      // - Replace with opacity: 1
      .replaceAll(/opacity:\s*0/g, "opacity: 1")
      // Regex explanation:
      // - visibility:\s*hidden matches visibility: hidden
      // - Replace with visibility: visible
      .replaceAll(/visibility:\s*hidden/g, "visibility: visible");

    cssContent = removeEmptyCssRules(cssContent);

    // Rebuild SVG with processed styles
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    svgContent = svgContent.replace(
      /<style>[\s\S]*<\/style>/,
      `<style>${cssContent}</style>`,
    );
    console.log("🖌️  [Convert API] CSS styles normalized.");

    // 3. Final cleanup of animation attributes
    svgContent = svgContent
      // Regex explanation:
      // - animation-delay:\s*\d+ms;? matches animation-delay properties
      // - Remove animation-delay properties
      .replaceAll(/animation-delay:\s*\d+ms;?/g, "")
      // Regex explanation:
      // - style="" matches style attributes
      // - Remove empty style attributes
      .replaceAll(' style=""', "")
      // Regex explanation:
      // - style="animation-delay: \d+ms" matches style attributes containing only animation-delay
      // - Remove style attributes containing only animation-delay
      .replaceAll(/ style="animation-delay: \d+ms"/g, "");
    console.log("🧼 [Convert API] Final SVG cleanup completed.");

    // 4. Convert the processed SVG to PNG using sharp
    console.log("🔄 [Convert API] Converting SVG to PNG using sharp...");
    const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const conversionDuration = Date.now() - startTime;
    console.log(
      `✅ [Convert API] SVG converted to PNG successfully in ${conversionDuration}ms`,
    );
    const analyticsClient = Redis.fromEnv();
    analyticsClient
      .incr("analytics:convert_api:successful_requests")
      .catch(() => {});
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
    const analyticsClient = Redis.fromEnv();
    analyticsClient
      .incr("analytics:convert_api:failed_requests")
      .catch(() => {});
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}
