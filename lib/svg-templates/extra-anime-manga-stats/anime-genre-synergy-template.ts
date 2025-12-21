import type { TrustedSVG } from "../../types/svg";
import { displayNames } from "../../card-data";
import { extraAnimeMangaStatsTemplate } from "./shared";

export type AnimeGenreSynergyTemplateInput = Omit<
  Parameters<typeof extraAnimeMangaStatsTemplate>[0],
  "format"
>;

export const animeGenreSynergyTemplate = (
  input: AnimeGenreSynergyTemplateInput,
): TrustedSVG => {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: displayNames["animeGenreSynergy"],
  });
};
