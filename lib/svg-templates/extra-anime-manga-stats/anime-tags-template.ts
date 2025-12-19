import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeTagsTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeTags` card type. */
export function animeTagsTemplate(input: AnimeTagsTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeTags"],
  });
}
