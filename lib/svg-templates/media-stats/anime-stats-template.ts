import type { TrustedSVG } from "@/lib/types/svg";

import { createMediaStatsTemplate } from "./shared";

export type AnimeStatsTemplateInput = Parameters<
  ReturnType<typeof createMediaStatsTemplate>
>[0];
export const animeStatsTemplate: (
  input: AnimeStatsTemplateInput,
) => TrustedSVG = createMediaStatsTemplate("anime");
