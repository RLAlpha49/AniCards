import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// TODO: Fix this shit, it's not working. That damn rank circle will be the death of me. It also somehow looks like shit compared to the svg.

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

    // 1. Fix rank circle animation properties
    // Regex explanation:
    // - \.rank-circle matches the CSS class name
    // - \s* allows any whitespace after class name
    // - {([^}]*)} captures everything between curly braces
    const rankCircleStyleMatch = svgContent.match(/\.rank-circle\s*{([^}]*)}/);
    if (rankCircleStyleMatch) {
      // Extract critical CSS properties for circle animation
      // Regex explanation:
      // - stroke-dasharray: matches the CSS property
      // - \s* allows whitespace after colon
      // - ([^;]+) captures everything until semicolon
      console.log(
        `🎨 [Convert API] Found rank-circle styles, processing animation properties.`,
      );
      const dashArray = rankCircleStyleMatch[1]
        .match(/stroke-dasharray:\s*([^;]+)/)?.[1]
        ?.trim();

      // Regex explanation:
      // - stroke-dashoffset: matches the CSS property
      // - \s* allows whitespace after colon
      // - ([^;]+) captures everything until semicolon
      const dashOffset = rankCircleStyleMatch[1]
        .match(/stroke-dashoffset:\s*([^;]+)/)?.[1]
        ?.trim();

      // Regex explanation:
      // - stroke: matches the CSS property
      // - ([^;]+) captures value until semicolon
      const strokeColor = rankCircleStyleMatch[1]
        .match(/stroke:\s*([^;]+)/)?.[1]
        ?.trim();

      // Inject inline styles to preserve animation state
      svgContent = svgContent.replace(
        '<circle class="rank-circle"',
        `<circle class="rank-circle" 
					stroke-dasharray="${dashArray}"
					stroke-dashoffset="${dashOffset}"
					stroke="${strokeColor}"
					fill="none"
					stroke-width="6"
					stroke-linecap="round"
					transform="rotate(-90deg)"
					transform-origin="-10px 8px"`,
      );
      console.log(`✅ [Convert API] Rank circle styles injected.`);
    } else {
      console.warn(`⚠️ [Convert API] No rank-circle styles found in SVG.`);
    }

    // 2. Normalize header styles
    // Regex explanation:
    // - \[data-testid="card-title"\] matches attribute selector
    // - text\s* matches text element with optional whitespace
    // - {\s*fill:\s* captures fill property with whitespace
    // - (#[0-9a-f]+|[\w-]+) matches hex colors or color names
    const headerColorMatch = svgContent.match(
      /\[data-testid="card-title"\] text\s*{\s*fill:\s*(#[0-9a-f]+|[\w-]+)/i,
    );
    const headerColor = headerColorMatch?.[1] || "#000";
    if (headerColorMatch) {
      console.log(`🎨 [Convert API] Header color detected: ${headerColor}`);
    } else {
      console.warn(
        `⚠️ [Convert API] Header color not detected, defaulting to ${headerColor}`,
      );
    }

    // 3. Force consistent header typography
    svgContent = svgContent
      // Regex explanation:
      // - \.header matches class name
      // - \s*{[^}]*} matches entire style block
      .replace(
        /\.header\s*{[^}]*}/,
        `.header { fill: ${headerColor}; font: 600 18px Arial, sans-serif; }`,
      )
      // Regex explanation:
      // - <text([^>]*) matches text tag opening with attributes
      // - class="header" matches specific class
      .replace(
        /<text([^>]*)class="header"/g,
        `<text$1fill="${headerColor}" font-family="Arial" font-size="18" font-weight="600"`,
      );

    // 4. Remove animation artifacts
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

    // 5. Process CSS styles
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    const styleMatch = svgContent.match(/<style>([\s\S]*?)<\/style>/);
    let cssContent = styleMatch?.[1] || "";
    cssContent =
      cssContent
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
        // - font:\s*[\d.]+px\s*([^;]+); matches font declarations
        // - Replace with font: 600 followed by the captured value
        .replace(/font:\s*[\d.]+px\s*([^;]+);/g, "font: 600 $1;")
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
        .replace(/[^{}]*{\s*}/g, "") +
      // Add preserved critical styles
      `
            .header, [data-testid="header"] {
                fill: ${headerColor} !important;
                font: 600 18px Arial, sans-serif !important;
            }`;

    // Rebuild SVG with processed styles
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    svgContent = svgContent.replace(
      /<style>[\s\S]*<\/style>/,
      `<style>${cssContent}</style>`,
    );
    console.log("🖌️ [Convert API] CSS styles normalized.");

    // 6. Final cleanup of animation attributes
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

    // 7. Convert the processed SVG to PNG using sharp
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
