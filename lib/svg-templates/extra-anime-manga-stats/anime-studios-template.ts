import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeStudiosTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeStudios` card type. */
export function animeStudiosTemplate(input: AnimeStudiosTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeStudios"],
  });
}
