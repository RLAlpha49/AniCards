/**
 * One card saved for a profile, as the user page renders it.
 *
 * @property type - Display name, for example `Anime Stats`.
 * @property svgUrl - Versioned card URL, so the browser asks for new artwork
 *   when the stats or the configuration change.
 * @property rawType - Card identifier the API uses, for example `animeStats`.
 * @property variation - Human label for the layout, for example `Pie Chart`.
 * @property preset - Human label for the colour preset, for example `AniList Dark`.
 * @property borderRadius - Corner radius the stored configuration asked for.
 * @source
 */
export type SavedCard = Readonly<{
  type: string;
  svgUrl: string;
  rawType: string;
  variation: string;
  preset: string;
  borderRadius: number;
}>;
