/**
 * Shapes shared by the visual audit's capture and report steps.
 *
 * The manifest is the only contract between the two: the capture writes it,
 * the report reads it. Keeping these types in their own module means the
 * report can be regenerated, or its layout changed, without touching the
 * capture and without re-rendering anything.
 *
 * @source
 */

/** Colours an audit renders with. A missing value falls back to the app default. @source */
type AuditColors = {
  titleColor?: string;
  backgroundColor?: string;
  textColor?: string;
  circleColor?: string;
  borderColor?: string;
};

/**
 * The rendering settings every variation is captured with.
 *
 * Recorded in the manifest so the report can describe a capture it did not
 * produce, and so two manifests can be compared to tell whether a visual
 * difference came from the code or from the audit settings.
 * @source
 */
export type AuditStyle = {
  /** Style name, used on the command line and shown in the report. */
  name: string;
  /** Named preset from `lib/cards/colour-presets.ts`, when the style uses one. */
  colorPreset?: string;
  colors: AuditColors;
  borderRadius: number;
  showFavorites: boolean;
  showPiePercentages: boolean;
  gridCols: number;
  gridRows: number;
};

/** Where the audited record came from. @source */
type AuditSource = {
  userId: string;
  username: string;
  /** Redis host the record was read from, so a local and a production run differ on the page. */
  redisHost: string;
};

/** One rendered card variation. @source */
export type Capture = {
  card: string;
  variation: string;
  /** Query parameters the variation inherits from its registry entry. */
  extras: Record<string, string>;
  file?: string;
  sha256?: string;
  /** Size of the SVG in bytes, so the report can flag unusually large output. */
  bytes?: number;
  /** Text suggesting the template fell back to an empty state or placeholders. */
  fallbackIndicators: string[];
  /** Another variation of the same card that produced byte-identical output. */
  identicalTo?: string;
  error?: string;
};

/** Everything the capture writes and the report reads. @source */
export type Manifest = {
  /** When the capture ran, not when the data was last updated. */
  generatedAt: string;
  /** The frozen clock the renderer saw. */
  fixedTime: string;
  timezone: string;
  source: AuditSource;
  style: AuditStyle;
  caveats: string[];
  captures: Capture[];
};
