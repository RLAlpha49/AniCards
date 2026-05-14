import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgAnchoredTextPair,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";

import type { ColorValue } from "../../types/card";
import type { TrustedSVG } from "../../types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "../../utils";
import { MILESTONES, SPACING, TYPOGRAPHY } from "../common/constants";
import { getCardDimensions } from "../common/dimensions";
import { toSvgIdFragment } from "../completion-progress-stats/shared";

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

const MIN_FITTED_FONT_SIZE = 8;
const TEXT_PAIR_GAP_PX = 12;
const SECONDARY_MAX_WIDTH_RATIO = 0.34;
const MIN_SECONDARY_MAX_WIDTH_PX = 54;
const MIN_VALUE_MAX_WIDTH_PX = 40;
const TITLE_HORIZONTAL_MARGIN = 2 * SPACING.CARD_PADDING; // Use the shared card padding on both sides of the title.
const TITLE_INITIAL_FONT_SIZE = TYPOGRAPHY.HEADER_SIZE; // Keep the fitted header aligned with the shared title size.

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
  backgroundColor: string;
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
    backgroundColor,
    delay,
  } = opts;

  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const { next, progress } = getTierProgress(safeValue, tiers);

  const barRadius = Math.max(4, Math.min(barHeight / 2, 10));
  const barWidth = (progress / 100) * width;
  const clipId = `${idPrefix}-clip-${toSvgIdFragment(label)}-${Math.round(x)}-${Math.round(y)}`;

  const targetText =
    next === null ? "Max tier" : `→ ${next.toLocaleString("en-US")}`;
  const rowFit = fitSvgAnchoredTextPair({
    availableWidth: width,
    gapPx: TEXT_PAIR_GAP_PX,
    primaryFontWeight: 600,
    primaryInitialFontSize: TYPOGRAPHY.SECTION_TITLE_SIZE,
    primaryMinFontSize: MIN_FITTED_FONT_SIZE,
    primaryText: label,
    secondaryInitialFontSize: TYPOGRAPHY.SMALL_TEXT_SIZE,
    secondaryMaxWidth: Math.max(
      MIN_SECONDARY_MAX_WIDTH_PX,
      Math.floor(width * SECONDARY_MAX_WIDTH_RATIO),
    ),
    secondaryMinFontSize: MIN_FITTED_FONT_SIZE,
    secondaryFontWeight: 500,
    secondaryText: targetText,
  });
  const valueText = safeValue.toLocaleString("en-US");
  const valueFit = fitSvgSingleLineText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
    maxWidth: Math.max(MIN_VALUE_MAX_WIDTH_PX, width - 24),
    minFontSize: MIN_FITTED_FONT_SIZE,
    mode: "shrink-then-truncate",
    text: valueText,
  });

  return `
    <g transform="translate(${x}, ${y})" class="stagger" style="animation-delay:${delay}ms">
      <rect x="-12" y="${MILESTONES.ROW_Y_OFFSET}" width="${width + 24}" height="${barHeight + MILESTONES.ROW_HEIGHT}" rx="12" opacity="0.08" />
      <text x="0" y="${MILESTONES.LABEL_Y_OFFSET}" class="row-label" fill="${textColor}"${rowFit ? ` font-size="${rowFit.primary.fontSize}"` : ""}>${escapeForXml(rowFit?.primary.text ?? label)}</text>
      <text x="${width}" y="${MILESTONES.LABEL_Y_OFFSET}" text-anchor="end" class="row-target" fill="${textColor}"${rowFit ? ` font-size="${rowFit.secondary.fontSize}"` : ""}>${escapeForXml(rowFit?.secondary.text ?? targetText)}</text>

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

      <text x="${width / 2}" y="${barHeight + MILESTONES.VALUE_Y_OFFSET}" text-anchor="middle" class="row-value" fill="${textColor}" stroke="${backgroundColor}" stroke-width="3" paint-order="stroke"${valueFit ? ` font-size="${valueFit.fontSize}"` : ""}>${escapeForXml(valueFit?.text ?? valueText)}</text>
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
  const titleMaxWidth = dims.w - TITLE_HORIZONTAL_MARGIN;
  const titleFit = resolveSvgTitleTextFit({
    initialFontSize: TITLE_INITIAL_FONT_SIZE,
    maxWidth: titleMaxWidth,
    text: title,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TITLE_INITIAL_FONT_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);

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
      font: 600 ${titleFit.fontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .row-label {
      font: 600 11px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.95;
    }

    .row-target {
      font: 500 10px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.75;
    }

    .row-value {
      font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif;
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
    <text x="0" y="0" class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
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
          backgroundColor: resolvedColors.backgroundColor,
          delay: MILESTONES.BASE_DELAY + index * MILESTONES.DELAY_INCREMENT,
        }),
      )
      .join("")}
  </g>
</svg>
`);
}
