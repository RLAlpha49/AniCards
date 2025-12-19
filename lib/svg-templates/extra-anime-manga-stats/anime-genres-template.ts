import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeGenresTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeGenres` card type. */
export function animeGenresTemplate(input: AnimeGenresTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeGenres"],
  });
}
