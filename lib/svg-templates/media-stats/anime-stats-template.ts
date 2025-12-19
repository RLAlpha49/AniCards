import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats/shared";

type BaseInput = Parameters<typeof mediaStatsTemplate>[0];
export type AnimeStatsTemplateInput = Omit<BaseInput, "mediaType">;

/**
 * SVG template for the `animeStats` card type.
 * Delegates to the shared `mediaStatsTemplate` with `mediaType: "anime"`.
 */
export function animeStatsTemplate(input: AnimeStatsTemplateInput) {
  return mediaStatsTemplate({ ...input, mediaType: "anime" });
}
