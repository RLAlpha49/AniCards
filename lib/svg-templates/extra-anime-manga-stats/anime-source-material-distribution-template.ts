import type { TrustedSVG } from "../../types/svg";
import { displayNames } from "../../card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

export type AnimeSourceMaterialDistributionTemplateInput = Omit<
  Parameters<typeof extraAnimeMangaStatsTemplate>[0],
  "format"
>;

export const animeSourceMaterialDistributionTemplate = (
  input: AnimeSourceMaterialDistributionTemplateInput,
): TrustedSVG => {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeSourceMaterialDistribution"],
  });
};
