import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeMetricRow,
} from "./shared";
import { toBarRows } from "@/lib/svg-templates/common/bars";
import { normalizedShannon } from "@/lib/stats/diversity";
import { formatInt, formatPercent } from "./stats-utils";

type CountryStat = { country: string; count: number };

function toBars(countries: CountryStat[] | undefined) {
  return toBarRows(
    countries,
    (c) => c.country,
    (c) => c.count,
  );
}

function buildMetrics(
  countries: CountryStat[] | undefined,
): ComparativeMetricRow[] {
  const items = (countries ?? []).filter(
    (c) => c && typeof c.country === "string",
  );
  const counts = items.map((c) => Math.max(0, c.count));
  const total = counts.reduce((a, b) => a + b, 0);
  const distinct = items.filter((c) => Math.max(0, c.count) > 0).length;

  const top = items
    .map((c) => ({ country: c.country, count: Math.max(0, c.count) }))
    .toSorted((a, b) => b.count - a.count)[0];

  const diversity = normalizedShannon(counts);

  return [
    { label: "Distinct", value: formatInt(distinct) },
    {
      label: "Top",
      value: top?.country
        ? `${top.country} (${formatPercent(top.count, total, 0)})`
        : "—",
    },
    { label: "Diversity", value: `${Math.round(diversity * 100)}%` },
  ];
}

export interface CountryDiversityTemplateInput {
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

export function countryDiversityTemplate(
  input: CountryDiversityTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  return comparativeTwoColumnTemplate({
    cardType: "countryDiversity",
    username: input.username,
    title: "Country Diversity",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(anime?.countries as CountryStat[] | undefined),
      bars: toBars(anime?.countries as CountryStat[] | undefined),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(manga?.countries as CountryStat[] | undefined),
      bars: toBars(manga?.countries as CountryStat[] | undefined),
    },
  });
}
