import { mediaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof mediaStatsTemplate>[0];
export type MangaStatsTemplateInput = Omit<BaseInput, "mediaType">;

/**
 * SVG template for the `mangaStats` card type.
 * Delegates to the shared `mediaStatsTemplate` with `mediaType: "manga"`.
 */
export function mangaStatsTemplate(input: MangaStatsTemplateInput) {
  return mediaStatsTemplate({ ...input, mediaType: "manga" });
}
