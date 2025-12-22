import { createMediaStatsTemplate } from "./shared";
export type MangaStatsTemplateInput = Parameters<
  ReturnType<typeof createMediaStatsTemplate>
>[0];
export const mangaStatsTemplate = createMediaStatsTemplate("manga");
