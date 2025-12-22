import { createMediaStatsTemplate } from "./shared";

export type AnimeStatsTemplateInput = Parameters<
  ReturnType<typeof createMediaStatsTemplate>
>[0];
export const animeStatsTemplate = createMediaStatsTemplate("anime");
