import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeMetricRow,
} from "./shared";
import { toBarRows } from "@/lib/svg-templates/common/bars";
import { formatInt, formatPercent } from "./stats-utils";

type LengthStat = { length: string; count: number };

function toBars(items: LengthStat[] | undefined) {
  return toBarRows(
    items,
    (l) => l.length,
    (l) => l.count,
  );
}

function buildMetrics(items: LengthStat[] | undefined): ComparativeMetricRow[] {
  const stats = (items ?? []).filter(
    (l) => typeof l.length === "string" && typeof l.count === "number",
  );
  const total = stats.reduce((a, b) => a + Math.max(0, b.count), 0);
  const top = stats
    .map((l) => ({ length: l.length, count: Math.max(0, l.count) }))
    .toSorted((a, b) => b.count - a.count)[0];
  return [
    { label: "Buckets", value: formatInt(stats.length) },
    {
      label: "Top",
      value: top
        ? `${top.length} (${formatPercent(top.count, total, 0)})`
        : "—",
    },
  ];
}

export interface LengthPreferenceTemplateInput {
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

export function lengthPreferenceTemplate(
  input: LengthPreferenceTemplateInput,
): TrustedSVG {
  return comparativeTwoColumnTemplate({
    cardType: "lengthPreference",
    username: input.username,
    title: "Length Preference",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(input.animeStats?.lengths as LengthStat[]),
      bars: toBars(input.animeStats?.lengths as LengthStat[]),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(input.mangaStats?.lengths as LengthStat[]),
      bars: toBars(input.mangaStats?.lengths as LengthStat[]),
    },
  });
}
