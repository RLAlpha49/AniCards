import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

// TODO: Fix this shit, it's not working. That damn rank circle will be the death of me. It also somehow looks like shit compared to the svg.

export async function POST(request: NextRequest) {
	try {
		const { svgUrl } = await request.json();
		const response = await fetch(svgUrl);
		let svgContent = await response.text();

		// 2. Extract and inject rank circle styles
		const rankCircleStyleMatch = svgContent.match(/\.rank-circle\s*{([^}]*)}/);
		if (rankCircleStyleMatch) {
			const style = rankCircleStyleMatch[1];
			const dashArray = style.match(/stroke-dasharray:\s*([^;]+)/)?.[1]?.trim() || "251.33";
			const dashOffset = style.match(/stroke-dashoffset:\s*([^;]+)/)?.[1]?.trim() || "132.20";
			const strokeColor = style.match(/stroke:\s*([^;]+)/)?.[1]?.trim() || "#fe428e";

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

		// 3. Fix header styles
		const headerColorMatch = svgContent.match(
			/\[data-testid="card-title"\] text\s*{\s*fill:\s*(#[0-9a-f]+|[\w-]+)/i
		);
		const headerColor = headerColorMatch?.[1] || "#fe428e";

		svgContent = svgContent
			.replace(
				/\.header\s*{[^}]*}/,
				`.header { fill: ${headerColor}; font: 600 18px Arial, sans-serif; }`
			)
			.replace(
				/<text([^>]*)class="header"/g,
				`<text$1fill="${headerColor}" font-family="Arial" font-size="18" font-weight="600"`
			);

		// 4. Remove opacity classes and fix visibility
		svgContent = svgContent
			.replace(/opacity:\s*0;?/g, "opacity: 1;")
			.replace(/\.stagger\s*{[^}]*}/g, "")
			.replace(/class="stagger"/g, "");

		// Extract and rebuild the entire style block
		const styleMatch = svgContent.match(/<style>([\s\S]*?)<\/style>/);
		let cssContent = styleMatch?.[1] || "";

		// Process CSS content
		cssContent =
			cssContent
				// Remove animations and keyframes
				.replace(/@keyframes\s+\w+\s*{[^}]*}/g, "")
				.replace(/animation:\s*[^;]+;?/g, "")
				// Remove orphaned to-blocks
				.replace(/}\s*to\s*{[^}]*}/g, "")
				.replace(/to\s*{[^}]*}/g, "")
				// Fix malformed opacity values
				.replace(/opacity:\s*1;\.(\d+);/g, "opacity: 0.$1;")
				// Fix font definitions
				.replace(/font:\s*[\d.]+px\s*([^;]+);/g, "font: 600 $1;")
				// Force visible states
				.replace(/opacity:\s*0/g, "opacity: 1")
				.replace(/visibility:\s*hidden/g, "visibility: visible")
				// Remove empty rulesets
				.replace(/[^{}]*{\s*}/g, "") +
			// Add preserved critical styles
			`
			.header, [data-testid="header"] {
				fill: ${headerColor} !important;
				font: 600 18px Arial, sans-serif !important;
			}`;

		// Rebuild the SVG with processed styles
		svgContent = svgContent.replace(/<style>[\s\S]*<\/style>/, `<style>${cssContent}</style>`);
		console.log(svgContent);

		// After rebuilding the SVG content
		svgContent = svgContent
			// Remove animation-delay from inline styles
			.replace(/animation-delay:\s*\d+ms;?/g, "")
			// Clean up empty style attributes
			.replace(/ style=""/g, "")
			// Remove animation-delay attributes on SVG elements
			.replace(/ style="animation-delay: \d+ms"/g, "");

		// Convert with sharp
		const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();

		const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

		return NextResponse.json({ pngDataUrl });
	} catch (error) {
		console.error("Conversion error:", error);
		return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
	}
}
