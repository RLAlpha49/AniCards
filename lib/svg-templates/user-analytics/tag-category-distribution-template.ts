import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "../comparative-distribution-stats/shared";

type TagStat = { tag: { name: string; category?: string }; count: number };

function groupByCategory(tags: TagStat[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(tags)) return map;

  for (const { tag, count } of tags) {
    const category = tag.category || "Uncategorized";
    map.set(category, (map.get(category) || 0) + count);
  }
  return map;
}

function toBars(tags: TagStat[] | undefined): ComparativeBarRow[] {
  const groups = groupByCategory(tags);
  return [...groups.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildMetrics(tags: TagStat[] | undefined): ComparativeMetricRow[] {
  const groups = groupByCategory(tags);
  const distinct = groups.size;

  const top = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    { label: "Categories", value: String(distinct) },
    { label: "Top", value: top ? top[0] : "—" },
  ];
}

export interface TagCategoryDistributionTemplateInput {
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

export function tagCategoryDistributionTemplate(
  input: TagCategoryDistributionTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  return comparativeTwoColumnTemplate({
    cardType: "tagCategoryDistribution",
    username: input.username,
    title: "Tag Categories",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(anime?.tags as TagStat[] | undefined),
      bars: toBars(anime?.tags as TagStat[] | undefined),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(manga?.tags as TagStat[] | undefined),
      bars: toBars(manga?.tags as TagStat[] | undefined),
    },
  });
}
