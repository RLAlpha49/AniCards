/**
 * The card size type is declared once, in `./dimensions`, beside the table of
 * sizes that produces it. Re-exported here so the shared option types stay in
 * one import.
 * @source
 */
export type { CardDimensions } from "./dimensions";

export interface StyleOptions {
  includeRankCircle?: boolean;
  includeStagger?: boolean;
  includeFadeIn?: boolean;
}

export interface TextOptions {
  fill?: string;
  fontSize?: number;
  fontWeight?: number;
  textAnchor?: string;
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
