import type { ColorValue } from "../../types/card";
import type { TrustedSVG } from "../../types/svg";
import { MILESTONES } from "../common/constants";
import { getCardDimensions } from "../common/dimensions";
import { estimateCardTextWidth } from "../common/text-metrics";
import { toSvgIdFragment } from "@/lib/svg-templates/completion-progress-stats/completion-progress-stats";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/cards/style";
import { processColorsForSVG } from "@/lib/color/gradients";
import { calculateDynamicFontSize } from "../common/text-metrics";

interface SocialMilestonesTemplateInput {
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
  stats: {
    followers: number;
    following: number;
    threads: number;
    threadComments: number;
    reviews: number;
  };
}

const SOCIAL_TIERS = {
  followers: [100, 500, 1000, 2500, 5000],
  following: [50, 200, 500, 1000, 2000],
  threads: [10, 50, 100, 250, 500],
  threadComments: [50, 200, 500, 1000, 2000],
  reviews: [10, 50, 100, 200, 500],
} as const;

const fitText = (text: string, width: number, fontSize: number): string => {
  const naturalWidth = estimateCardTextWidth(text, fontSize, 600);
  if (naturalWidth <= width) return "";
  const scaledSize = Math.max(6, (fontSize * width) / naturalWidth);
  return `style="font-size:${scaledSize.toFixed(2)}px"`;
};

function getTierProgress(
  value: number,
  tiers: readonly number[],
): {
  current: number;
  next: number | null;
  progress: number;
} {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const next = tiers.find((t) => safe < t) ?? null;
  let current = 0;
  for (const t of tiers) {
    if (t <= safe) current = t;
  }

  if (next === null && tiers.length > 0) {
    current = tiers.at(-1) ?? current;
  }

  if (next === null) {
    return { current, next: null, progress: 100 };
  }

  const range = next - current;
  const progress = range > 0 ? ((safe - current) / range) * 100 : 100;
  return { current, next, progress: Math.min(100, Math.max(0, progress)) };
}

function renderMilestoneRow(opts: {
  label: string;
  value: number;
  tiers: readonly number[];
  x: number;
  y: number;
  width: number;
  barHeight: number;
  idPrefix: string;
  barColor: string;
  textColor: string;
  delay: number;
}): string {
  const {
    label,
    value,
    tiers,
    x,
    y,
    width,
    barHeight,
    idPrefix,
    barColor,
    textColor,
    delay,
  } = opts;

  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const { next, progress } = getTierProgress(safeValue, tiers);

  const barRadius = Math.max(4, Math.min(barHeight / 2, 10));
  const barWidth = (progress / 100) * width;
  const clipId = `${idPrefix}-clip-${toSvgIdFragment(label)}-${Math.round(x)}-${Math.round(y)}`;

  const targetText = next === null ? "Max tier" : `→ ${next.toLocaleString()}`;
  const valueText = safeValue.toLocaleString();
  const progressText = `${valueText} ${targetText}`;

  return `
    <g transform="translate(${x}, ${y})" class="stagger" style="animation-delay:${delay}ms">
      <rect x="-12" y="${MILESTONES.ROW_Y_OFFSET}" width="${width + 24}" height="${barHeight + MILESTONES.ROW_HEIGHT}" rx="12" opacity="0.08" />
      <text x="0" y="${MILESTONES.LABEL_Y_OFFSET}" class="row-label" fill="${textColor}">${escapeForXml(label)}</text>
      <text x="${width}" y="${MILESTONES.LABEL_Y_OFFSET}" text-anchor="end" class="row-target" fill="${textColor}" ${fitText(progressText, width - 125, 11)}><tspan class="row-value">${escapeForXml(valueText)}</tspan><tspan dx="6">${escapeForXml(targetText)}</tspan></text>

      <defs>
        <clipPath id="${clipId}">
          <rect x="0" y="0" width="${width}" height="${barHeight}" rx="${barRadius}" />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="${width}" height="${barHeight}" rx="${barRadius}" fill="${barColor}" opacity="0.16" />
      <g clip-path="url(#${clipId})">
        <rect x="0" y="0" width="${barWidth.toFixed(2)}" height="${barHeight}" fill="${barColor}" />
        <rect x="0" y="0" width="${barWidth.toFixed(2)}" height="${Math.max(1, Math.floor(barHeight / 2))}" fill="#ffffff" opacity="0.12" />
      </g>
    </g>
  `;
}

export function socialMilestonesTemplate(
  input: SocialMilestonesTemplateInput,
): TrustedSVG {
  const { username, styles, variant = "default", stats } = input;

  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: styles.titleColor,
      backgroundColor: styles.backgroundColor,
      textColor: styles.textColor,
      circleColor: styles.circleColor,
      borderColor: styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const dims = getCardDimensions("socialMilestones", variant);
  const cardRadius = getCardBorderRadius(styles.borderRadius);

  const title = `${username}'s Social Milestones`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = Number(
    calculateDynamicFontSize(title, 18, dims.w - 40),
  );

  const idPrefix = `sm-${toSvgIdFragment(username)}-${toSvgIdFragment(variant)}`;

  const barWidth = dims.w - 40;
  const barHeight = MILESTONES.BAR_HEIGHT;
  const rowSpacing = 40;

  const rows = [
    {
      label: "Followers",
      value: stats.followers,
      tiers: SOCIAL_TIERS.followers,
    },
    {
      label: "Following",
      value: stats.following,
      tiers: SOCIAL_TIERS.following,
    },
    { label: "Threads", value: stats.threads, tiers: SOCIAL_TIERS.threads },
    {
      label: "Thread Comments",
      value: stats.threadComments,
      tiers: SOCIAL_TIERS.threadComments,
    },
    { label: "Reviews", value: stats.reviews, tiers: SOCIAL_TIERS.reviews },
  ];

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}

  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">${escapeForXml(
    `Followers ${stats.followers}, Following ${stats.following}, Threads ${stats.threads}, Thread Comments ${stats.threadComments}, Reviews ${stats.reviews}`,
  )}</desc>

  <style>
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .row-label {
      font: 600 11px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.95;
    }

    .row-target {
      font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .row-value {
      font-weight: 700;
    }

    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.35s ease-in-out forwards;
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

  <g transform="translate(20, 34)">
    <text x="0" y="0" class="header" ${fitText(title, dims.w - 40, headerFontSize)}>${safeTitle}</text>
  </g>

  <g transform="translate(0, 64)">
    ${rows
      .map((row, index) =>
        renderMilestoneRow({
          label: row.label,
          value: row.value,
          tiers: row.tiers,
          x: 20,
          y: index * rowSpacing,
          width: barWidth,
          barHeight,
          idPrefix,
          barColor: resolvedColors.circleColor,
          textColor: resolvedColors.textColor,
          delay: MILESTONES.BASE_DELAY + index * MILESTONES.DELAY_INCREMENT,
        }),
      )
      .join("")}
  </g>
</svg>
`);
}
