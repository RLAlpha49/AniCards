import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type MangaFormatDistributionTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `mangaFormatDistribution` card type. */
export function mangaFormatDistributionTemplate(
  input: MangaFormatDistributionTemplateInput,
) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["mangaFormatDistribution"],
  });
}
