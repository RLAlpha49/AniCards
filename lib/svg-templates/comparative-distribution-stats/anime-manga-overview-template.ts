import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeMetricRow,
} from "./shared";
import { formatInt, formatScore } from "./stats-utils";

function formatDaysFromMinutes(minutes: number | undefined | null): string {
  const v =
    typeof minutes === "number" && Number.isFinite(minutes) ? minutes : 0;
  const days = v / 1440;
  return `${days.toFixed(1)}d`;
}

export interface AnimeMangaOverviewTemplateInput {
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

export function animeMangaOverviewTemplate(
  input: AnimeMangaOverviewTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  const leftMetrics: ComparativeMetricRow[] = [
    { label: "Entries", value: formatInt(anime?.count) },
    { label: "Mean score", value: formatScore(anime?.meanScore) },
    { label: "Std dev", value: formatScore(anime?.standardDeviation) },
    { label: "Episodes", value: formatInt(anime?.episodesWatched) },
    { label: "Time", value: formatDaysFromMinutes(anime?.minutesWatched) },
  ];

  const rightMetrics: ComparativeMetricRow[] = [
    { label: "Entries", value: formatInt(manga?.count) },
    { label: "Mean score", value: formatScore(manga?.meanScore) },
    { label: "Std dev", value: formatScore(manga?.standardDeviation) },
    { label: "Chapters", value: formatInt(manga?.chaptersRead) },
    { label: "Volumes", value: formatInt(manga?.volumesRead) },
  ];

  return comparativeTwoColumnTemplate({
    cardType: "animeMangaOverview",
    username: input.username,
    title: "Anime vs Manga Overview",
    variant: input.variant,
    styles: input.styles,
    left: { title: "Anime", metrics: leftMetrics },
    right: { title: "Manga", metrics: rightMetrics },
  });
}
