export interface CardDimensions {
  w: number;
  h: number;
}

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
