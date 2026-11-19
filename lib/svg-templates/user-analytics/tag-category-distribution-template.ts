import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import type { UserStatsData } from "@/lib/types/records";
import {
  getCardDimensions,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import { calculateDynamicFontSize } from "@/lib/svg-templates/common/text-metrics";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/card-style";
import { processColorsForSVG } from "@/lib/color/gradients";
import { toBarRows } from "@/lib/svg-templates/common/bars";
import {
  type ComparativeMetricRow,
  renderFittedText,
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

function toBars(tags: TagStat[] | undefined) {
  return toBarRows(
    [...groupByCategory(tags).entries()],
    ([label]) => label,
    ([, count]) => count,
  );
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
  const animeTags = input.animeStats?.tags as TagStat[] | undefined;
  const mangaTags = input.mangaStats?.tags as TagStat[] | undefined;
  const columns = [
    {
      title: "Anime",
      metrics: buildMetrics(animeTags),
      bars: toBars(animeTags),
    },
    {
      title: "Manga",
      metrics: buildMetrics(mangaTags),
      bars: toBars(mangaTags),
    },
  ];
  const baseDims = getCardDimensions("tagCategoryDistribution", input.variant);
  const chartY = 117;
  const rowHeight = 26;
  const rows = Math.max(...columns.map((column) => column.bars.length));
  const dims = {
    ...baseDims,
    h: Math.max(baseDims.h, chartY + Math.max(0, rows - 1) * rowHeight + 40),
  };
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: input.styles.titleColor,
      backgroundColor: input.styles.backgroundColor,
      textColor: input.styles.textColor,
      circleColor: input.styles.circleColor,
      borderColor: input.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );
  const title = `${input.username}'s Tag Categories`;
  const titleSize =
    Number.parseFloat(calculateDynamicFontSize(title, 18, dims.w - 40)) ||
    TYPOGRAPHY.HEADER_SIZE;
  const colWidth = (dims.w - SPACING.CARD_PADDING * 2 - 20) / 2;

  const renderColumn = (column: (typeof columns)[number], index: number) => {
    const x = SPACING.CARD_PADDING + index * (colWidth + 20);
    const barColor =
      index === 0 ? resolvedColors.circleColor : resolvedColors.titleColor;
    const maxCount = Math.max(
      1,
      ...column.bars.map((bar) => (Number.isFinite(bar.count) ? bar.count : 0)),
    );
    const metrics = column.metrics
      .map(
        (metric, i) => `
          <text class="stat" x="0" y="${90 + i * 19}">${escapeForXml(metric.label)}</text>
          ${renderFittedText(colWidth, 90 + i * 19, metric.value, "stat-value", colWidth - 80, TYPOGRAPHY.STAT_VALUE_SIZE, "end")}`,
      )
      .join("");
    const bars = column.bars
      .map((bar, i) => {
        const y = chartY + i * rowHeight;
        const count = Number.isFinite(bar.count) ? bar.count : 0;
        const countText = Math.round(count).toLocaleString("en-US");
        const barWidth = Math.min(
          colWidth,
          Math.max(2, (Math.max(0, count) / maxCount) * colWidth),
        );
        return `
          ${renderFittedText(0, y + 10, bar.label, "stat", colWidth - 60, TYPOGRAPHY.STAT_SIZE)}
          ${renderFittedText(colWidth, y + 10, countText, "stat", 55, TYPOGRAPHY.STAT_SIZE, "end")}
          <rect x="0" y="${y + 14}" width="${colWidth}" height="7" rx="3" fill="${resolvedColors.textColor}" opacity="0.14" />
          <rect x="0" y="${y + 14}" width="${barWidth}" height="7" rx="3" fill="${barColor}" />`;
      })
      .join("");
    return `
      <g transform="translate(${x}, 0)">
        <text class="stat-label" x="0" y="67">${column.title}</text>
        <rect x="0" y="72" width="${colWidth}" height="2" rx="1" fill="${barColor}" opacity="0.7" />
        ${metrics}
        ${bars}
      </g>`;
  };

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${escapeForXml(title)}</title>
      <style>${generateCommonStyles(resolvedColors, titleSize)}</style>
      ${generateCardBackground(dims, getCardBorderRadius(input.styles.borderRadius), resolvedColors)}
      <g transform="translate(20, ${SPACING.HEADER_Y})" data-testid="card-title">
        ${renderFittedText(0, 0, title, "header", dims.w - 40, titleSize, undefined, 600)}
      </g>
      <g data-testid="main-card-body">${columns.map(renderColumn).join("")}</g>
    </svg>
  `);
}
