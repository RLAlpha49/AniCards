import { createDistributionTemplate } from "./shared";

export type MangaScoreDistributionTemplateInput = Parameters<
  ReturnType<typeof createDistributionTemplate>
>[0];
export const mangaScoreDistributionTemplate = createDistributionTemplate(
  "manga",
  "score",
);
