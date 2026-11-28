import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeMetricRow,
} from "@/lib/svg-templates/comparative-distribution-stats/comparative-distribution-stats";
import { toBarRows } from "@/lib/svg-templates/common";
import { normalizedShannon } from "@/lib/stats/diversity";

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

function toBars(tags: TagStat[] | undefined) {
  return toBarRows(
    [...groupByCategory(tags).entries()],
    ([label]) => label,
    ([, count]) => count,
    5,
  );
}

function buildMetrics(tags: TagStat[] | undefined): ComparativeMetricRow[] {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [
      { label: "Diversity", value: "0%" },
      { label: "Distinct Tags", value: "0" },
    ];
  }

  const counts = tags.map((t) => Math.max(0, t.count));
  const diversity = Math.round(normalizedShannon(counts) * 100);
  const distinct = tags.filter((t) => t.count > 0).length;

  return [
    { label: "Diversity", value: `${diversity}%` },
    { label: "Distinct Tags", value: distinct.toLocaleString("en-US") },
  ];
}

interface TagDiversityTemplateInput {
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

export function tagDiversityTemplate(
  input: TagDiversityTemplateInput,
): TrustedSVG {
  const anime = input.animeStats;
  const manga = input.mangaStats;

  return comparativeTwoColumnTemplate({
    cardType: "tagDiversity",
    username: input.username,
    title: "Tag Diversity",
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
