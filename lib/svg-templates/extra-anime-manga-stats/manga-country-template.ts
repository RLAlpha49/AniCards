import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type MangaCountryTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `mangaCountry` card type. */
export function mangaCountryTemplate(input: MangaCountryTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["mangaCountry"],
  });
}
