import { displayNames } from "../../card-data";
import type { TrustedSVG } from "../../types/svg";
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
