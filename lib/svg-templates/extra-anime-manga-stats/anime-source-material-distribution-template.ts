import type { TrustedSVG } from "../../types/svg";
import { displayNames } from "../../card-data";
import { extraAnimeMangaStatsTemplate } from "./extra-anime-manga-stats";

type AnimeSourceMaterialDistributionTemplateInput = Omit<
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
