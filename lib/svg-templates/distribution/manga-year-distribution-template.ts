import { createDistributionTemplate } from "./shared";

export type MangaYearDistributionTemplateInput = Parameters<
  ReturnType<typeof createDistributionTemplate>
>[0];
export const mangaYearDistributionTemplate = createDistributionTemplate(
  "manga",
  "year",
);
