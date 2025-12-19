import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeCountryTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeCountry` card type. */
export function animeCountryTemplate(input: AnimeCountryTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeCountry"],
  });
}
