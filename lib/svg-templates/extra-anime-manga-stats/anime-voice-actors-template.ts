import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeVoiceActorsTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeVoiceActors` card type. */
export function animeVoiceActorsTemplate(input: AnimeVoiceActorsTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeVoiceActors"],
  });
}
