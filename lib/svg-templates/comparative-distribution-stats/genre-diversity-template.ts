import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "./shared";
import { formatInt, formatPercent, normalizedShannon } from "./stats-utils";

type GenreStat = { genre: string; count: number };

function toBars(genres: GenreStat[] | undefined): ComparativeBarRow[] {
  return (genres ?? [])
    .filter((g) => typeof g.genre === "string")
    .map((g) => ({ label: g.genre, count: g.count }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildMetrics(genres: GenreStat[] | undefined): ComparativeMetricRow[] {
  const items = (genres ?? []).filter((g) => g && typeof g.genre === "string");
  const counts = items.map((g) => Math.max(0, g.count));
  const total = counts.reduce((a, b) => a + b, 0);
  const distinct = items.filter((g) => Math.max(0, g.count) > 0).length;

  const top = items
    .map((g) => ({ genre: g.genre, count: Math.max(0, g.count) }))
    .toSorted((a, b) => b.count - a.count)[0];

  const diversity = normalizedShannon(counts);

  return [
    { label: "Distinct", value: formatInt(distinct) },
    {
      label: "Top",
      value: top?.genre
        ? `${top.genre} (${formatPercent(top.count, total, 0)})`
        : "—",
    },
    { label: "Diversity", value: `${Math.round(diversity * 100)}%` },
  ];
}

export interface GenreDiversityTemplateInput {
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

export function genreDiversityTemplate(
  input: GenreDiversityTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  return comparativeTwoColumnTemplate({
    cardType: "genreDiversity",
    username: input.username,
    title: "Genre Diversity",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(anime?.genres as GenreStat[] | undefined),
      bars: toBars(anime?.genres as GenreStat[] | undefined),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(manga?.genres as GenreStat[] | undefined),
      bars: toBars(manga?.genres as GenreStat[] | undefined),
    },
  });
}
