import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeStatusDistributionTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeStatusDistribution` card type. */
export function animeStatusDistributionTemplate(
  input: AnimeStatusDistributionTemplateInput,
) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeStatusDistribution"],
  });
}
