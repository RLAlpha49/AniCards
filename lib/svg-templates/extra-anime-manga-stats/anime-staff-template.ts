import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeStaffTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeStaff` card type. */
export function animeStaffTemplate(input: AnimeStaffTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeStaff"],
  });
}
