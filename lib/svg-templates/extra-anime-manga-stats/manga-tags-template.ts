import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type MangaTagsTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `mangaTags` card type. */
export function mangaTagsTemplate(input: MangaTagsTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["mangaTags"],
  });
}
