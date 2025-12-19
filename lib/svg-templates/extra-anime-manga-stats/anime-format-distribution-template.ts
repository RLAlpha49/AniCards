import { displayNames } from "@/lib/card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

type BaseInput = Parameters<typeof extraAnimeMangaStatsTemplate>[0];
export type AnimeFormatDistributionTemplateInput = Omit<BaseInput, "format">;

/** SVG template for the `animeFormatDistribution` card type. */
export function animeFormatDistributionTemplate(
  input: AnimeFormatDistributionTemplateInput,
) {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeFormatDistribution"],
  });
}
