import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "./shared";
import { formatInt, formatPercent } from "./stats-utils";

type YearStat = { releaseYear: number; count: number };

function toDecadeLabel(year: number): string | null {
  if (!Number.isFinite(year) || year < 1900) return null;
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

function buildDecadeBars(years: YearStat[] | undefined): {
  bars: ComparativeBarRow[];
  metrics: ComparativeMetricRow[];
} {
  const items = (years ?? []).filter(
    (y) => typeof y.releaseYear === "number" && typeof y.count === "number",
  );

  const decadeMap = new Map<string, number>();
  let weightedSum = 0;
  let total = 0;

  for (const y of items) {
    const year = y.releaseYear;
    const count = Math.max(0, y.count);
    const decade = toDecadeLabel(year);
    if (!decade) continue;
    decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + count);
    weightedSum += year * count;
    total += count;
  }

  const bars = Array.from(decadeMap.entries())
    .map(([label, count]) => ({ label, count }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 8);

  const top = bars[0];
  const avgYear = total > 0 ? Math.round(weightedSum / total) : 0;

  const metrics: ComparativeMetricRow[] = [
    { label: "Avg year", value: avgYear ? String(avgYear) : "—" },
    {
      label: "Top decade",
      value: top ? `${top.label} (${formatPercent(top.count, total, 0)})` : "—",
    },
    { label: "Decades", value: formatInt(decadeMap.size) },
  ];

  return { bars, metrics };
}

export interface ReleaseEraPreferenceTemplateInput {
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

export function releaseEraPreferenceTemplate(
  input: ReleaseEraPreferenceTemplateInput,
): TrustedSVG {
  const anime = buildDecadeBars(input.animeStats?.releaseYears as YearStat[]);
  const manga = buildDecadeBars(input.mangaStats?.releaseYears as YearStat[]);

  return comparativeTwoColumnTemplate({
    cardType: "releaseEraPreference",
    username: input.username,
    title: "Release Era Preference",
    variant: input.variant,
    styles: input.styles,
    left: { title: "Anime", metrics: anime.metrics, bars: anime.bars },
    right: { title: "Manga", metrics: manga.metrics, bars: manga.bars },
  });
}
