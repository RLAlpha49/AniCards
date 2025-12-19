import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type MangaStaffTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `mangaStaff` card type. */
export function mangaStaffTemplate(input: MangaStaffTemplateInput) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["mangaStaff"],
  });
}
