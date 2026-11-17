/**
 * Escaping values for XML and marking strings as already-sanitized SVG.
 * @source
 */
import type { TrustedSVG } from "@/lib/types/svg";

/**
 * Escape a string for safe embedding inside XML/SVG text nodes or attributes.
 * This function escapes the five XML special characters and normalizes inputs
 * to a string. It is intentionally small and deterministic — templates should
 * use the original unescaped values for measurement (e.g. dynamic font sizing)
 * and only embed escaped values in the final markup.
 * @param value - The potentially unsafe string value.
 * @returns An escaped string safe to include inside an XML document.
 * @source
 */
export function escapeForXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Simple runtime branding for trusted SVG strings. The return value prepends a
 * compact marker comment to the serialized SVG. This allows client-side checks
 * to assert that a string was produced by one of the project's templates or
 * explicitly sanitized pipelines.
 * NOTE: The comment itself is harmless and will not affect the rendering of
 * the resulting SVG, but it gives us a deterministic signal at runtime.
 * @param svg - The sanitized SVG string.
 * @returns A marked string typed as TrustedSVG.
 */
export function markTrustedSvg(svg: string): TrustedSVG {
  const prefix = "<!--ANICARDS_TRUSTED_SVG-->";
  return `${prefix}${svg}` as TrustedSVG;
}

/**
 * Check whether the provided string is a marked Trusted SVG.
 * This is a lightweight runtime guard used by client components that render
 * pre-sanitized SVG markup to ensure the string passed to
 * `dangerouslySetInnerHTML` came from one of our trusted template helpers.
 * @param svg - The string to check.
 * @returns True if the string is marked as trusted.
 */
export function isTrustedSvgString(svg: unknown): boolean {
  if (typeof svg !== "string") return false;
  return svg.startsWith("<!--ANICARDS_TRUSTED_SVG-->");
}
