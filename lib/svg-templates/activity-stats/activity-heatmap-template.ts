import type { ColorValue } from "@/lib/types/card";
import type { ActivityHistoryItem } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";
import { getHeatmapColor, type HeatmapPalette } from "./shared";

/**
 * Generates a GitHub-style activity heatmap calendar.
 * @param data - Template input with username, styles, activity history, and variant.
 * @returns TrustedSVG string for the heatmap card.
 * @source
 */
export function activityHeatmapTemplate(data: {
  username: string;
  variant?: "default" | "github" | "fire";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const palette = (data.variant as HeatmapPalette) || "default";
  const title = `${data.username}'s Activity Heatmap`;
  const safeTitle = escapeForXml(title);

  // Process activity history into a date map
  const activityMap = new Map<string, number>();
  let maxAmount = 1;

  for (const item of data.activityHistory) {
    const date = new Date(item.date * 1000);
    const key = date.toISOString().split("T")[0];
    const current = activityMap.get(key) || 0;
    const newAmount = current + item.amount;
    activityMap.set(key, newAmount);
    maxAmount = Math.max(maxAmount, newAmount);
  }

  // Generate calendar grid for the last ~90 days (13 weeks)
  const weeks = 13;
  const cellSize = 10;
  const cellGap = 2;
  const now = new Date();
  // Start from midnight UTC today
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  startDate.setUTCDate(startDate.getUTCDate() - weeks * 7 + 1);
  // Align to start of week (Sunday) in UTC
  startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());

  const cells: string[] = [];
  const currentDate = new Date(startDate);

  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const key = currentDate.toISOString().split("T")[0];
      const amount = activityMap.get(key) || 0;
      const intensity = amount / maxAmount;
      const colorData = getHeatmapColor(
        intensity,
        palette,
        resolvedColors.titleColor,
      );
      const x = 25 + week * (cellSize + cellGap);
      const y = 55 + day * (cellSize + cellGap);

      cells.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${cellSize}"
          height="${cellSize}"
          rx="2"
          fill="${colorData.color}"
          ${colorData.opacity === 1 ? "" : `fill-opacity="${colorData.opacity}"`}
          class="stagger"
          style="animation-delay: ${300 + week * 30 + day * 10}ms"
        >
          <title>${key}: ${amount} activities</title>
        </rect>
      `);

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  // Day labels
  const dayLabels = ["Sun", "", "Tue", "", "Thu", "", "Sat"];
  const dayLabelsSvg = dayLabels
    .map((label, i) =>
      label
        ? `<text x="10" y="${62 + i * (cellSize + cellGap)}" class="day-label">${label}</text>`
        : "",
    )
    .join("");

  const dims = { w: 220, h: 160 };

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Activity heatmap showing ${data.activityHistory.length} activity entries</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, 180)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .day-label {
      fill: ${resolvedColors.textColor};
      font: 400 8px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.7;
    }
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>
  <rect
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(15, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  ${dayLabelsSvg}
  ${cells.join("")}
</svg>
`);
}
