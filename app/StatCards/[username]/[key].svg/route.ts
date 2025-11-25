/**
 * Serves the /StatCards/<username>/<key>.svg route with a static notice SVG.
 * @returns Response containing the update prompt SVG content.
 * @source
 */
export async function GET() {
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="150">
      <rect width="100%" height="100%" fill="#0b1622"/>
      <text x="50%" y="25%" dominant-baseline="middle" text-anchor="middle"
            fill="#3cc8ff" font-size="30" font-family="Segoe UI">
        AniCards Updated!
      </text>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            fill="#E8E8E8" font-size="18" font-family="Segoe UI">
        <tspan x="50%" dy="0">Go to anicards.alpha49.com</tspan>
        <tspan x="50%" dy="1.2em">to regenerate statcards.</tspan>
      </text>
    </svg>
  `;

  return new Response(svgContent, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache",
    },
  });
}
