import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

// TODO: Fix this shit, it's not working. That damn rank circle will be the death of me. It also somehow looks like shit compared to the svg.

// API endpoint for converting SVG to PNG with style fixes
export async function POST(request: NextRequest) {
	try {
		// Fetch and process SVG content
		const { svgUrl } = await request.json();
		const response = await fetch(svgUrl);
		let svgContent = await response.text();

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
			const strokeColor = rankCircleStyleMatch[1].match(/stroke:\s*([^;]+)/)?.[1]?.trim();

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
					transform-origin="-10px 8px"`
			);
		}

		// 2. Normalize header styles
		// Regex explanation:
		// - \[data-testid="card-title"\] matches attribute selector
		// - text\s* matches text element with optional whitespace
		// - {\s*fill:\s* captures fill property with whitespace
		// - (#[0-9a-f]+|[\w-]+) matches hex colors or color names
		const headerColorMatch = svgContent.match(
			/\[data-testid="card-title"\] text\s*{\s*fill:\s*(#[0-9a-f]+|[\w-]+)/i
		);
		const headerColor = headerColorMatch?.[1];

		// Force consistent header typography
		svgContent = svgContent
			// Regex explanation:
			// - \.header matches class name
			// - \s*{[^}]*} matches entire style block
			.replace(
				/\.header\s*{[^}]*}/,
				`.header { fill: ${headerColor}; font: 600 18px Arial, sans-serif; }`
			)
			// Regex explanation:
			// - <text([^>]*) matches text tag opening with attributes
			// - class="header" matches specific class
			.replace(
				/<text([^>]*)class="header"/g,
				`<text$1fill="${headerColor}" font-family="Arial" font-size="18" font-weight="600"`
			);

		// 3. Remove animation artifacts
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

		// 4. Process CSS styles
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
		svgContent = svgContent.replace(/<style>[\s\S]*<\/style>/, `<style>${cssContent}</style>`);

		// Final cleanup of animation artifacts
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

		// Convert to PNG using sharp
		const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
		const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

		return NextResponse.json({ pngDataUrl });
	} catch (error) {
		console.error("Conversion error:", error);
		return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
	}
}
