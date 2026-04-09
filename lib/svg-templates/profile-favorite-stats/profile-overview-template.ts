import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ANIMATION,
  PROFILE,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import type { UserAvatar, UserStatistics } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
  toFiniteNumber,
} from "@/lib/utils";

import { generateCardBackground } from "../common/base-template-utils";
import { generateCommonStyles } from "../common/style-generators";
import { type TemplateStyles } from "./shared";

function fontSizeAttr(fontSize: number | null | undefined): string {
  return typeof fontSize === "number" ? ` font-size="${fontSize}"` : "";
}

function isSvgIdFragmentChar(char: string): boolean {
  return (
    (char >= "a" && char <= "z") ||
    (char >= "0" && char <= "9") ||
    char === "_" ||
    char === "-"
  );
}

function trimOuterHyphens(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === "-") {
    start += 1;
  }

  while (end > start && value[end - 1] === "-") {
    end -= 1;
  }

  return value.slice(start, end);
}

function toSvgIdFragment(value: string): string {
  const rawValue = String(value ?? "").trim();
  const lowerValue = rawValue.toLowerCase();

  let sanitized = "";
  let previousWasDash = false;

  for (const char of lowerValue) {
    if (isSvgIdFragmentChar(char)) {
      sanitized += char;
      previousWasDash = false;
      continue;
    }

    if (!previousWasDash) {
      sanitized += "-";
      previousWasDash = true;
    }
  }

  sanitized = trimOuterHyphens(sanitized);

  if (sanitized) {
    return sanitized.slice(0, 48);
  }

  let hash = 0;
  for (const char of rawValue || "user") {
    hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  }

  const suffix = hash.toString(36).padStart(6, "0");

  return `user-${suffix || "id"}`.slice(0, 48);
}

function fitText(
  text: string,
  maxWidth: number,
  fontWeight: number,
  initialFontSize: number,
) {
  return fitSvgSingleLineText({
    fontWeight,
    initialFontSize,
    maxWidth,
    minFontSize: TYPOGRAPHY.MIN_FONT_SIZE,
    mode: "shrink-then-truncate",
    text,
  });
}

const SECTION_TITLE_MAX_WIDTH = 72;
const STAT_VALUE_MAX_WIDTH = 46;
const STAT_LABEL_MAX_WIDTH = 64;
const STAT_LABEL_LARGE_MAX_WIDTH = 118;
const ACTIVE_SECTION_TITLE_MAX_WIDTH = 70;
const YEARS_ACTIVE_VALUE_MAX_WIDTH = 26;
const YEARS_ACTIVE_UNIT_MAX_WIDTH = 52;

function resolveAvatarHrefAttr(avatarUrl: string): string | null {
  if (!avatarUrl.startsWith("data:")) {
    return null;
  }

  return `href="${escapeForXml(avatarUrl)}"`;
}

function buildAvatarMarkup(args: {
  avatarHrefAttr: string | null;
  avatarUrl?: string;
  circleColor: string;
  clipId: string;
}): string {
  if (!args.avatarUrl) {
    return "";
  }

  const imageMarkup = args.avatarHrefAttr
    ? `
        <image
          x="0" y="0" width="${PROFILE.AVATAR_SIZE}" height="${PROFILE.AVATAR_SIZE}"
          ${args.avatarHrefAttr}
          clip-path="url(#${args.clipId})"
          preserveAspectRatio="xMidYMid slice"
        />`
    : "";

  return `
      <g transform="translate(20, 10)">
        <clipPath id="${args.clipId}">
          <circle cx="${PROFILE.AVATAR_RADIUS}" cy="${PROFILE.AVATAR_RADIUS}" r="${PROFILE.AVATAR_RADIUS}"/>
        </clipPath>
        ${imageMarkup}
        <circle cx="${PROFILE.AVATAR_RADIUS}" cy="${PROFILE.AVATAR_RADIUS}" r="${PROFILE.AVATAR_RADIUS}" fill="none" stroke="${args.circleColor}" stroke-width="${PROFILE.AVATAR_STROKE_WIDTH}"/>
      </g>
    `;
}

function buildProfileStatSection(args: {
  animationDelayMs: number;
  countFontSize?: number | null;
  countText: string;
  labelX?: number;
  sectionTitleFontSize?: number | null;
  sectionTitleText: string;
  statLabelFontSize?: number | null;
  statLabelText: string;
  summaryFontSize?: number | null;
  summaryText: string;
  transform?: string;
}): string {
  const transformAttr = args.transform ? ` transform="${args.transform}"` : "";
  const labelX = args.labelX ?? 50;

  return `
        <g class="stagger" style="animation-delay: ${args.animationDelayMs}ms"${transformAttr}>
          <text class="section-title" x="0" y="0"${fontSizeAttr(args.sectionTitleFontSize)}>${escapeForXml(args.sectionTitleText)}</text>
          <text class="stat-value" x="0" y="20"${fontSizeAttr(args.countFontSize)}>${escapeForXml(args.countText)}</text>
          <text class="stat-label" x="${labelX}" y="20"${fontSizeAttr(args.statLabelFontSize)}>${escapeForXml(args.statLabelText)}</text>
          <text class="stat-label" x="0" y="40"${fontSizeAttr(args.summaryFontSize)}>${escapeForXml(args.summaryText)}</text>
        </g>
      `;
}

function buildActiveProfileSection(args: {
  activeTitleFontSize?: number | null;
  activeTitleText: string;
  animationDelayMs: number;
  unitFontSize?: number | null;
  unitText: string;
  valueFontSize?: number | null;
  valueText: string;
  yearsActive?: number;
}): string {
  if (!args.yearsActive) {
    return "";
  }

  return `
        <g class="stagger" style="animation-delay: ${args.animationDelayMs}ms" transform="translate(${PROFILE.YEARS_SECTION_X}, 0)">
          <text class="section-title" x="0" y="0"${fontSizeAttr(args.activeTitleFontSize)}>${escapeForXml(args.activeTitleText)}</text>
          <text class="stat-value" x="0" y="20"${fontSizeAttr(args.valueFontSize)}>${escapeForXml(args.valueText)}</text>
          <text class="stat-label" x="30" y="20"${fontSizeAttr(args.unitFontSize)}>${escapeForXml(args.unitText)}</text>
        </g>
      `;
}

function buildProfileOverviewContent(args: {
  activeSectionMarkup: string;
  animeCountFontSize?: number | null;
  animeCountText: string;
  animeSectionTitleFontSize?: number | null;
  animeSectionTitleText: string;
  animeSummaryFontSize?: number | null;
  animeSummaryText: string;
  animeUnitFontSize?: number | null;
  animeUnitText: string;
  avatarMarkup: string;
  mangaCountFontSize?: number | null;
  mangaCountText: string;
  mangaSectionTitleFontSize?: number | null;
  mangaSectionTitleText: string;
  mangaSummaryFontSize?: number | null;
  mangaSummaryText: string;
  mangaUnitFontSize?: number | null;
  mangaUnitText: string;
  usernameLengthAdjustAttrs: string;
  usernameText: string;
}): string {
  const animeSectionMarkup = buildProfileStatSection({
    animationDelayMs: Math.max(0, ANIMATION.BASE_DELAY - 150),
    countFontSize: args.animeCountFontSize,
    countText: args.animeCountText,
    sectionTitleFontSize: args.animeSectionTitleFontSize,
    sectionTitleText: args.animeSectionTitleText,
    statLabelFontSize: args.animeUnitFontSize,
    statLabelText: args.animeUnitText,
    summaryFontSize: args.animeSummaryFontSize,
    summaryText: args.animeSummaryText,
  });
  const mangaSectionMarkup = buildProfileStatSection({
    animationDelayMs: ANIMATION.BASE_DELAY,
    countFontSize: args.mangaCountFontSize,
    countText: args.mangaCountText,
    sectionTitleFontSize: args.mangaSectionTitleFontSize,
    sectionTitleText: args.mangaSectionTitleText,
    statLabelFontSize: args.mangaUnitFontSize,
    statLabelText: args.mangaUnitText,
    summaryFontSize: args.mangaSummaryFontSize,
    summaryText: args.mangaSummaryText,
    transform: `translate(${PROFILE.SECTION_SPACING}, 0)`,
  });

  return `
      <g data-testid="card-title" transform="translate(100, 45)">
        <text x="0" y="0" class="header"${args.usernameLengthAdjustAttrs}>${args.usernameText}</text>
      </g>
      ${args.avatarMarkup}
      <g data-testid="main-card-body" transform="translate(20, 100)">
        ${animeSectionMarkup}
        ${mangaSectionMarkup}
        ${args.activeSectionMarkup}
      </g>
    `;
}

/**
 * Renders the Profile Overview card showing avatar, display name, and high-level
 * counters (total anime, total manga, days watched, chapters read).
 * @param data - Template input including username, styles, statistics, and avatar.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const profileOverviewTemplate = (data: {
  username: string;
  variant?: "default";
  styles: TemplateStyles;
  statistics: UserStatistics;
  avatar?: UserAvatar;
  avatarDataUrl?: string;
  createdAt?: number;
  uniqueId?: string;
}): TrustedSVG => {
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

  const animeStats = data.statistics.anime;
  const mangaStats = data.statistics.manga;

  const daysWatched = Math.round(
    (toFiniteNumber(animeStats.minutesWatched, { fallback: 0 }) ?? 0) /
      (60 * 24),
  );

  const yearsActive = data.createdAt
    ? Math.max(
        1,
        Math.floor(
          (Date.now() / 1000 - data.createdAt) / (365.25 * 24 * 60 * 60),
        ),
      )
    : undefined;

  const dims = getCardDimensions("profileOverview", "default");
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const animationsEnabled =
    (data.styles as { animate?: boolean }).animate !== false;

  const title = `${data.username}'s Profile`;
  const safeTitle = escapeForXml(title);
  const usernameMaxWidth = dims.w - PROFILE.USERNAME_OFFSET;
  const usernameFit = resolveSvgTitleTextFit({
    maxWidth: usernameMaxWidth,
    text: data.username,
  });
  const usernameLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(
    usernameFit,
    {
      initialFontSize: TYPOGRAPHY.USERNAME_SIZE,
      maxWidth: usernameMaxWidth,
    },
  );

  const avatarUrl =
    data.avatarDataUrl || data.avatar?.medium || data.avatar?.large;
  const avatarClipSource =
    data.uniqueId?.trim() || data.username?.trim() || "anon";
  const avatarClipId = `avatar-clip-${toSvgIdFragment(avatarClipSource)}`;

  const yearSuffix = yearsActive && yearsActive > 1 ? "s" : "";
  const yearsActiveText = yearsActive
    ? `Active for ${yearsActive} year${yearSuffix}.`
    : "";
  const animeSectionTitleFit = fitText(
    "ANIME",
    SECTION_TITLE_MAX_WIDTH,
    600,
    TYPOGRAPHY.SECTION_TITLE_SIZE,
  );
  const animeCountText = String(animeStats.count ?? 0);
  const animeCountFit = fitText(
    animeCountText,
    STAT_VALUE_MAX_WIDTH,
    600,
    TYPOGRAPHY.STAT_VALUE_SIZE,
  );
  const animeUnitFit = fitText(
    "titles",
    STAT_LABEL_MAX_WIDTH,
    400,
    TYPOGRAPHY.STAT_LABEL_SIZE,
  );
  const animeDaysText = `${daysWatched} days watched`;
  const animeDaysFit = fitText(
    animeDaysText,
    STAT_LABEL_LARGE_MAX_WIDTH,
    400,
    TYPOGRAPHY.STAT_LABEL_SIZE,
  );
  const mangaSectionTitleFit = fitText(
    "MANGA",
    SECTION_TITLE_MAX_WIDTH,
    600,
    TYPOGRAPHY.SECTION_TITLE_SIZE,
  );
  const mangaCountText = String(mangaStats.count ?? 0);
  const mangaCountFit = fitText(
    mangaCountText,
    STAT_VALUE_MAX_WIDTH,
    600,
    TYPOGRAPHY.STAT_VALUE_SIZE,
  );
  const mangaUnitFit = fitText(
    "titles",
    STAT_LABEL_MAX_WIDTH,
    400,
    TYPOGRAPHY.STAT_LABEL_SIZE,
  );
  const mangaChaptersText = `${mangaStats.chaptersRead ?? 0} chapters read`;
  const mangaChaptersFit = fitText(
    mangaChaptersText,
    STAT_LABEL_LARGE_MAX_WIDTH,
    400,
    TYPOGRAPHY.STAT_LABEL_SIZE,
  );
  const activeTitleFit = fitText(
    "ACTIVE",
    ACTIVE_SECTION_TITLE_MAX_WIDTH,
    600,
    TYPOGRAPHY.SECTION_TITLE_SIZE,
  );
  const yearsActiveValueText = yearsActive ? String(yearsActive) : "";
  const yearsActiveValueFit = yearsActive
    ? fitText(
        yearsActiveValueText,
        YEARS_ACTIVE_VALUE_MAX_WIDTH,
        600,
        TYPOGRAPHY.STAT_VALUE_SIZE,
      )
    : null;
  const yearsActiveUnitText = `year${yearSuffix}`;
  const yearsActiveUnitFit = yearsActive
    ? fitText(
        yearsActiveUnitText,
        YEARS_ACTIVE_UNIT_MAX_WIDTH,
        400,
        TYPOGRAPHY.STAT_LABEL_SIZE,
      )
    : null;
  const usernameText = escapeForXml(usernameFit.text || data.username);
  const avatarHrefAttr = avatarUrl ? resolveAvatarHrefAttr(avatarUrl) : null;
  const avatarMarkup = buildAvatarMarkup({
    avatarHrefAttr,
    avatarUrl,
    circleColor: resolvedColors.circleColor,
    clipId: avatarClipId,
  });
  const activeSectionMarkup = buildActiveProfileSection({
    activeTitleFontSize: activeTitleFit?.fontSize,
    activeTitleText: activeTitleFit?.text ?? "ACTIVE",
    animationDelayMs: ANIMATION.BASE_DELAY + 150,
    unitFontSize: yearsActiveUnitFit?.fontSize,
    unitText: yearsActiveUnitFit?.text ?? yearsActiveUnitText,
    valueFontSize: yearsActiveValueFit?.fontSize,
    valueText: yearsActiveValueFit?.text ?? yearsActiveValueText,
    yearsActive,
  });
  const contentMarkup = buildProfileOverviewContent({
    activeSectionMarkup,
    animeCountFontSize: animeCountFit?.fontSize,
    animeCountText: animeCountFit?.text ?? animeCountText,
    animeSectionTitleFontSize: animeSectionTitleFit?.fontSize,
    animeSectionTitleText: animeSectionTitleFit?.text ?? "ANIME",
    animeSummaryFontSize: animeDaysFit?.fontSize,
    animeSummaryText: animeDaysFit?.text ?? animeDaysText,
    animeUnitFontSize: animeUnitFit?.fontSize,
    animeUnitText: animeUnitFit?.text ?? "titles",
    avatarMarkup,
    mangaCountFontSize: mangaCountFit?.fontSize,
    mangaCountText: mangaCountFit?.text ?? mangaCountText,
    mangaSectionTitleFontSize: mangaSectionTitleFit?.fontSize,
    mangaSectionTitleText: mangaSectionTitleFit?.text ?? "MANGA",
    mangaSummaryFontSize: mangaChaptersFit?.fontSize,
    mangaSummaryText: mangaChaptersFit?.text ?? mangaChaptersText,
    mangaUnitFontSize: mangaUnitFit?.fontSize,
    mangaUnitText: mangaUnitFit?.text ?? "titles",
    usernameLengthAdjustAttrs,
    usernameText,
  });

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">
    Anime: ${animeStats.count} titles, ${daysWatched} days watched.
    Manga: ${mangaStats.count} titles, ${mangaStats.chaptersRead} chapters read.
    ${yearsActiveText}
  </desc>

  <style>
    ${generateCommonStyles(resolvedColors, usernameFit.fontSize, { includeAnimations: animationsEnabled })}

    .username {
      fill: ${resolvedColors.titleColor};
      font: 700 ${TYPOGRAPHY.USERNAME_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .avatar-clip {
      clip-path: circle(${PROFILE.AVATAR_RADIUS}px at ${PROFILE.AVATAR_RADIUS + 5}px ${PROFILE.AVATAR_RADIUS + 5}px);
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  ${contentMarkup}
</svg>
`);
};
