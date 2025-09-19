import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

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
      parsedUrl = new URL(svgUrl);
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
      "localhost",
      "127.0.0.1",
    ];
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      console.warn(
        `⚠️ [Convert API] Unauthorized domain in 'svgUrl': ${parsedUrl.hostname} from ${ip}`,
      );
      return NextResponse.json(
        { error: "Unauthorized domain" },
        { status: 403 },
      );
    }

    console.log(`🔍 [Convert API] Fetching SVG from: ${svgUrl}`);
    const response = await fetch(svgUrl);
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
      .replace(/opacity:\s*0;?/g, "opacity: 1;")
      // Regex explanation:
      // - \.stagger matches the CSS class name
      // - {[^}]*} matches everything between curly braces
      // Remove entire .stagger CSS blocks
      .replace(/\.stagger\s*{[^}]*}/g, "")
      // Regex explanation:
      // - class="stagger" matches class="stagger"
      // Replace all class="stagger" attributes with an empty string
      .replace(/class="stagger"/g, "");
    console.log("🧹 [Convert API] Removed animation artifacts.");

    // 2. Process CSS styles
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    const styleMatch = RegExp(/<style>([\s\S]*?)<\/style>/).exec(svgContent);
    let cssContent = styleMatch?.[1] || "";
    cssContent = cssContent
      // Regex explanation:
      // - @keyframes\s+\w+\s*{[^}]*} matches @keyframes blocks
      // - \s+\w+ matches the animation name
      // - {[^}]*} matches everything between curly braces
      .replace(/@keyframes\s+\w+\s*{[^}]*}/g, "")
      // Regex explanation:
      // - animation:\s*[^;]+;? matches animation properties
      // - Remove animation properties
      .replace(/animation:\s*[^;]+;?/g, "")
      // Regex explanation:
      // - } matches the closing brace
      // - \s*to\s* matches optional whitespace followed by "to"
      // - {[^}]*} matches everything between curly braces
      // Remove orphaned to-blocks
      .replace(/}\s*to\s*{[^}]*}/g, "")
      // Regex explanation:
      // - to\s* matches optional whitespace followed by "to"
      // - {[^}]*} matches everything between curly braces
      .replace(/to\s*{[^}]*}/g, "")
      // Regex explanation:
      // - opacity:\s*1;\.(\d+); matches opacity values with 1 and a decimal point
      // - Replace with opacity: 0. followed by the captured decimal
      .replace(/opacity:\s*1;\.(\d+);/g, "opacity: 0.$1;")
      // Regex explanation:
      // - opacity:\s*0 matches opacity: 0
      // - Replace with opacity: 1
      .replace(/opacity:\s*0/g, "opacity: 1")
      // Regex explanation:
      // - visibility:\s*hidden matches visibility: hidden
      // - Replace with visibility: visible
      .replace(/visibility:\s*hidden/g, "visibility: visible")
      // Regex explanation:
      // - [^{}]*{\s*} matches empty CSS rulesets
      // - Replace with an empty string
      .replace(/[^{}]*{\s*}/g, "");

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
      .replace(/animation-delay:\s*\d+ms;?/g, "")
      // Regex explanation:
      // - style="" matches style attributes
      // - Remove empty style attributes
      .replace(/ style=""/g, "")
      // Regex explanation:
      // - style="animation-delay: \d+ms" matches style attributes containing only animation-delay
      // - Remove style attributes containing only animation-delay
      .replace(/ style="animation-delay: \d+ms"/g, "");
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
