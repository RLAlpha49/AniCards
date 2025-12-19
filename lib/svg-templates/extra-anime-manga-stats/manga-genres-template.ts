import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type MangaGenresTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `mangaGenres` card type. */
export function mangaGenresTemplate(input: MangaGenresTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["mangaGenres"],
  });
}
