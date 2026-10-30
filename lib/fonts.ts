import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";

/**
 * Display face for home page headings: a Mincho serif with strong vertical
 * strokes.
 *
 * Preloading is off on purpose. Both families are CJK, and Google serves each
 * weight as roughly 120 `unicode-range` slices, so preloading eagerly pulled
 * about 9 MB of font files into every page load. The browser still downloads
 * the slices whose glyphs are actually rendered.
 * @source
 */
export const displayFont = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
  preload: false,
});

/**
 * Body face for home page copy: a humanist gothic with generous counters.
 * @source
 */
export const bodyFont = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

/**
 * Publishes the home type variables on `:root`.
 *
 * The faces are imported by the home route only, so their CSS ships with that
 * route instead of the whole app. The shared header, footer, and GitHub
 * button sit in the root layout, above the home surface, so they read the
 * variables from `:root` rather than inheriting them from a descendant.
 * @source
 */
export const homeFontStyles = `:root{--font-display:${displayFont.style.fontFamily};--font-body:${bodyFont.style.fontFamily}}`;
