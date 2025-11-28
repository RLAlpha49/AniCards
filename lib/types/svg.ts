/**
 * Type branding for trusted SVG strings produced by internal templates or
 * sanitized helpers. This prevents accidental usage of unchecked strings in
 * components that render SVG via `dangerouslySetInnerHTML` at compile time.
 *
 * The brand is compile-time only, but consumers (like LivePreview) also use
 * a lightweight runtime check by looking for the HTML comment marker we
 * prefix when sanitizing/marking SVG strings.
 */
export type TrustedSVG = string & { readonly __trustedSVGBrand?: true };

/**
 * Helper that strips the trusted SVG marker if it's present. This is useful
 * in server response paths where a clean SVG (without our debug marker) is
 * preferred.
 * @param svg - A string that may or may not have the Trusted SVG marker.
 */
export function stripTrustedSvgMarker(svg: string) {
  const prefix = "<!--ANICARDS_TRUSTED_SVG-->";
  if (svg.startsWith(prefix)) return svg.slice(prefix.length);
  return svg;
}

/**
 * Helper used in API routes to extract a clean SVG string suitable as the
 * Response body. Accepts a TrustedSVG-typed value and returns a plain string
 * with the marker stripped. The runtime implementation reuses
 * `stripTrustedSvgMarker` to keep behaviour consistent.
 * @param svg - TrustedSVG value returned by internal templates.
 */
export function toCleanSvgResponse(svg: TrustedSVG): string {
  return stripTrustedSvgMarker(svg as string);
}
