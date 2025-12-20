import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "./shared";
import { formatInt, formatPercent } from "./stats-utils";

type StartYearStat = { startYear: number; count: number };

function toYearBars(items: StartYearStat[] | undefined): ComparativeBarRow[] {
  return (items ?? [])
    .filter(
      (s) => typeof s.startYear === "number" && Number.isFinite(s.startYear),
    )
    .map((s) => ({ label: String(s.startYear), count: s.count }))
    .toSorted((a, b) => Number(b.label) - Number(a.label))
    .slice(0, 8);
}

function buildMetrics(
  items: StartYearStat[] | undefined,
): ComparativeMetricRow[] {
  const stats = (items ?? []).filter(
    (s) => typeof s.startYear === "number" && typeof s.count === "number",
  );
  const total = stats.reduce((a, b) => a + Math.max(0, b.count), 0);
  const peak = stats
    .map((s) => ({ year: s.startYear, count: Math.max(0, s.count) }))
    .toSorted((a, b) => b.count - a.count)[0];

  const now = new Date().getFullYear();
  const recentCutoff = now - 4;
  const recentTotal = stats
    .filter((s) => s.startYear >= recentCutoff)
    .reduce((a, b) => a + Math.max(0, b.count), 0);

  return [
    { label: "Years", value: formatInt(stats.length) },
    {
      label: "Peak",
      value: peak
        ? `${peak.year} (${formatPercent(peak.count, total, 0)})`
        : "—",
    },
    { label: "Recent 5y", value: formatPercent(recentTotal, total, 0) },
  ];
}

export interface StartYearMomentumTemplateInput {
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

export function startYearMomentumTemplate(
  input: StartYearMomentumTemplateInput,
): TrustedSVG {
  return comparativeTwoColumnTemplate({
    cardType: "startYearMomentum",
    username: input.username,
    title: "Start-Year Momentum",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(input.animeStats?.startYears as StartYearStat[]),
      bars: toYearBars(input.animeStats?.startYears as StartYearStat[]),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(input.mangaStats?.startYears as StartYearStat[]),
      bars: toYearBars(input.mangaStats?.startYears as StartYearStat[]),
    },
  });
}
