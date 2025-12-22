import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "./shared";
import { formatInt, formatPercent } from "./stats-utils";

type FormatStat = { format: string; count: number };

function toBars(formats: FormatStat[] | undefined): ComparativeBarRow[] {
  return (formats ?? [])
    .filter((f) => typeof f.format === "string")
    .map((f) => ({ label: f.format, count: f.count }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildMetrics(
  formats: FormatStat[] | undefined,
): ComparativeMetricRow[] {
  const items = (formats ?? []).filter(
    (f) => f && typeof f.format === "string",
  );
  const total = items.reduce((a, b) => a + Math.max(0, b.count), 0);
  const top = items
    .map((f) => ({ format: f.format, count: Math.max(0, f.count) }))
    .toSorted((a, b) => b.count - a.count)[0];

  return [
    { label: "Formats", value: formatInt(items.length) },
    {
      label: "Top",
      value: top?.format
        ? `${top.format} (${formatPercent(top.count, total, 0)})`
        : "—",
    },
  ];
}

export interface FormatPreferenceOverviewTemplateInput {
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

export function formatPreferenceOverviewTemplate(
  input: FormatPreferenceOverviewTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  return comparativeTwoColumnTemplate({
    cardType: "formatPreferenceOverview",
    username: input.username,
    title: "Format Preference Overview",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(anime?.formats as FormatStat[] | undefined),
      bars: toBars(anime?.formats as FormatStat[] | undefined),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(manga?.formats as FormatStat[] | undefined),
      bars: toBars(manga?.formats as FormatStat[] | undefined),
    },
  });
}
