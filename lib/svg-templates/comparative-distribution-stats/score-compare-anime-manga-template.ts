import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "./shared";
import { formatScore } from "./stats-utils";

function toScoreBars(
  scores: { score: number; count: number }[] | undefined,
): ComparativeBarRow[] {
  return (scores ?? [])
    .filter((s) => typeof s.score === "number" && typeof s.count === "number")
    .map((s) => ({ label: String(s.score), count: s.count }))
    .slice(0, 8);
}

export interface ScoreCompareAnimeMangaTemplateInput {
  username: string;
  variant?: "default";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animeStats: UserStatsData["User"]["statistics"]["anime"] | undefined;
  mangaStats: UserStatsData["User"]["statistics"]["manga"] | undefined;
}

export function scoreCompareAnimeMangaTemplate(
  input: ScoreCompareAnimeMangaTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  const leftMetrics: ComparativeMetricRow[] = [
    { label: "Mean", value: formatScore(anime?.meanScore) },
    { label: "Std dev", value: formatScore(anime?.standardDeviation) },
  ];

  const rightMetrics: ComparativeMetricRow[] = [
    { label: "Mean", value: formatScore(manga?.meanScore) },
    { label: "Std dev", value: formatScore(manga?.standardDeviation) },
  ];

  return comparativeTwoColumnTemplate({
    cardType: "scoreCompareAnimeManga",
    username: input.username,
    title: "Anime vs Manga Score Comparison",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime (Top scores)",
      metrics: leftMetrics,
      bars: toScoreBars(anime?.scores),
    },
    right: {
      title: "Manga (Top scores)",
      metrics: rightMetrics,
      bars: toScoreBars(manga?.scores),
    },
  });
}
