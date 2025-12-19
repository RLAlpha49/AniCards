import { createDistributionTemplate } from "./shared";

export type AnimeYearDistributionTemplateInput = Parameters<
  ReturnType<typeof createDistributionTemplate>
>[0];
export const animeYearDistributionTemplate = createDistributionTemplate(
  "anime",
  "year",
);
