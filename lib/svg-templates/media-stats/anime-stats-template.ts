import { createMediaStatsTemplate } from "./shared";
import type { TrustedSVG } from "@/lib/types/svg";

export type AnimeStatsTemplateInput = Parameters<
  ReturnType<typeof createMediaStatsTemplate>
>[0];
export const animeStatsTemplate: (input: AnimeStatsTemplateInput) => TrustedSVG = createMediaStatsTemplate("anime");
