import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type MangaStatusDistributionTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `mangaStatusDistribution` card type. */
export function mangaStatusDistributionTemplate(
  input: MangaStatusDistributionTemplateInput,
) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["mangaStatusDistribution"],
  });
}
