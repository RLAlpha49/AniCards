import { createDistributionTemplate } from "./shared";

export type AnimeScoreDistributionTemplateInput = Parameters<
  ReturnType<typeof createDistributionTemplate>
>[0];
export const animeScoreDistributionTemplate = createDistributionTemplate(
  "anime",
  "score",
);
