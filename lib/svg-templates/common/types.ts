export interface CardDimensions {
  w: number;
  h: number;
}

export interface StyleOptions {
  includeRankCircle?: boolean;
  includeStagger?: boolean;
  includeFadeIn?: boolean;
  includeAnimations?: boolean;
}

export interface TextOptions {
  fill?: string;
  fontSize?: number;
  fontWeight?: number;
  /** Controls whether SVG stretches spacing only or both spacing and glyphs to fit `textLength`. */
  lengthAdjust?: "spacing" | "spacingAndGlyphs";
  /** Aligns text relative to its x position using start, middle, or end anchoring. */
  textAnchor?: "start" | "middle" | "end";
  /** Target rendered width for the text in SVG units. @remarks Pair with `lengthAdjust` to fit this width. */
  textLength?: number;
}

export interface RectOptions {
  rx?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export interface GroupOptions {
  className?: string;
  animationDelay?: string;
  dataTestId?: string;
}
