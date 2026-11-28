/**
 * Hex and HSL conversion with validation. Pure string and number work: no
 * gradients and no SVG.
 * @source
 */
/**
 * Validates a hex color string (3, 6, or 8 character format with leading #).
 * @param color - The color string to validate.
 * @returns True if the color is a valid hex color.
 * @source
 */
export function isValidHexColor(color: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color);
}

function normalizeHexRgb(hex: string): string | null {
  const raw = String(hex ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;

  // Expand #rgb to #rrggbb
  const short = /^#([0-9a-f]{3})$/.exec(withHash);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // Drop the alpha channel from #rrggbbaa. HSL has no alpha, and reading the
  // first six digits keeps the derived colours correct instead of falling
  // through to black.
  const withAlpha = /^(#[0-9a-f]{6})[0-9a-f]{2}$/.exec(withHash);
  if (withAlpha) return withAlpha[1];

  if (/^#[0-9a-f]{6}$/.test(withHash)) return withHash;
  return null;
}

/**
 * Convert a hex RGB color into HSL.
 *
 * @param hex - Color in #rrggbb (or #rgb) format.
 * @returns Tuple [h, s, l] where each component is in the range 0..1.
 */
export function hexToHsl(hex: string): [number, number, number] {
  const normalized = normalizeHexRgb(hex);
  if (!normalized) return [0, 0, 0];

  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

/**
 * Convert HSL to a hex RGB color.
 *
 * @param h - Hue in range 0..1.
 * @param s - Saturation in range 0..1.
 * @param l - Lightness in range 0..1.
 * @returns Color in #rrggbb format.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hh = Math.max(0, Math.min(1, Number.isFinite(h) ? h : 0));
  const ss = Math.max(0, Math.min(1, Number.isFinite(s) ? s : 0));
  const ll = Math.max(0, Math.min(1, Number.isFinite(l) ? l : 0));

  let r: number;
  let g: number;
  let b: number;

  if (ss === 0) {
    r = g = b = ll;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }

  const toHex = (c: number) =>
    Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
