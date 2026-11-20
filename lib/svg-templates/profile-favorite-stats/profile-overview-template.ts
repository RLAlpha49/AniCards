import type { TrustedSVG } from "@/lib/types/svg";
import type { UserAvatar, UserStatistics } from "@/lib/types/records";
import {
  ANIMATION,
  PROFILE,
  TYPOGRAPHY,
  calculateDynamicFontSize,
  getCardDimensions,
} from "@/lib/svg-templates/common";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/card-style";
import { processColorsForSVG } from "@/lib/color/gradients";
import { toFiniteNumber } from "@/lib/numbers";
import { fitText, type ProfileVariant, type TemplateStyles } from "./shared";
import { generateCommonStyles } from "../common/style-generators";
import { generateCardBackground } from "../common/base-template-utils";

/**
 * Renders the Profile Overview card showing avatar, display name, and high-level
 * counters (total anime, total manga, days watched, chapters read).
 * @param data - Template input including username, styles, statistics, and avatar.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const profileOverviewTemplate = (data: {
  username: string;
  variant?: ProfileVariant;
  styles: TemplateStyles;
  statistics: UserStatistics;
  avatar?: UserAvatar;
  avatarDataUrl?: string;
  createdAt?: number;
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

  // Calculate days watched from minutes
  const daysWatched = Math.round(
    (toFiniteNumber(animeStats.minutesWatched, { fallback: 0 }) ?? 0) /
      (60 * 24),
  );

  // Calculate years active if createdAt is available
  const yearsActive = data.createdAt
    ? Math.max(
        1,
        Math.floor(
          (Date.now() / 1000 - data.createdAt) / (365.25 * 24 * 60 * 60),
        ),
      )
    : undefined;

  const variant = data.variant ?? "default";
  const dims = getCardDimensions("profileOverview", variant);
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Profile`;
  const safeTitle = escapeForXml(title);
  const safeUsername = escapeForXml(data.username);
  const titleFontSize = Number.parseFloat(calculateDynamicFontSize(title));

  const avatarUrl =
    data.avatarDataUrl || data.avatar?.medium || data.avatar?.large;

  const yearSuffix = yearsActive && yearsActive > 1 ? "s" : "";
  const yearsActiveText = yearsActive
    ? `Active for ${yearsActive} year${yearSuffix}.`
    : "";
  const isDataUrl = data.avatarDataUrl?.startsWith("data:");
  const hrefAttr = isDataUrl
    ? `href="${escapeForXml(avatarUrl)}"`
    : `xlink:href="${escapeForXml(avatarUrl)}"`;
  const isDefault = variant === "default";
  const isMinimal = variant === "minimal";
  const showAvatar = !isMinimal && !!avatarUrl;
  const avatarSize = isDefault ? PROFILE.AVATAR_SIZE : 44;
  const avatarRadius = avatarSize / 2;
  const headerX = showAvatar ? (isDefault ? 100 : 78) : 20;
  const headerWidth = isMinimal && yearsActive ? 160 : dims.w - headerX - 20;
  const activeLabel = `${yearsActive} year${yearSuffix} active`;
  const metrics = [
    { label: "ANIME", value: animeStats.count },
    { label: "MANGA", value: mangaStats.count },
    { label: "DAYS", value: daysWatched },
    { label: "CHAPTERS", value: mangaStats.chaptersRead },
  ];

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
    ${generateCommonStyles(resolvedColors, titleFontSize)}

    [data-testid="main-card-body"] .stat-value {
      fill: ${isDefault ? resolvedColors.textColor : resolvedColors.circleColor};
    }

    .metric-label {
      font: 600 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  <g data-testid="card-title" transform="translate(${headerX}, ${isMinimal ? 30 : 33})">
    <text x="0" y="0" class="header" ${fitText(data.username, headerWidth, titleFontSize)}>${safeUsername}</text>
  </g>
  ${
    yearsActive
      ? `<text class="stat-label" x="${isMinimal ? 280 : headerX}" y="${isMinimal ? 30 : 53}" ${isMinimal ? 'text-anchor="end"' : ""} ${fitText(activeLabel, isMinimal ? 90 : dims.w - headerX - 20, 12)}>${activeLabel}</text>`
      : ""
  }
  ${
    showAvatar
      ? `<g transform="translate(20, ${isDefault ? 10 : 12})">
          <clipPath id="avatar-clip">
            <circle cx="${avatarRadius}" cy="${avatarRadius}" r="${avatarRadius}"/>
          </clipPath>
          <image x="0" y="0" width="${avatarSize}" height="${avatarSize}" ${hrefAttr}
            clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice"/>
          <circle cx="${avatarRadius}" cy="${avatarRadius}" r="${avatarRadius}" fill="none" stroke="${resolvedColors.circleColor}" stroke-width="${PROFILE.AVATAR_STROKE_WIDTH}"/>
        </g>`
      : ""
  }
  ${
    isDefault
      ? `<g data-testid="main-card-body" transform="translate(20, 100)">
          ${[
            {
              label: "ANIME",
              count: animeStats.count,
              detail: `${daysWatched} days watched`,
            },
            {
              label: "MANGA",
              count: mangaStats.count,
              detail: `${mangaStats.chaptersRead} chapters read`,
            },
          ]
            .map(
              (item, index) => `
              <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - 150 + index * 150}ms" transform="translate(${index * PROFILE.SECTION_SPACING}, 0)">
                <text class="section-title" x="0" y="0">${item.label}</text>
                <text x="0" y="20" ${fitText(`${item.count} titles`, 110, 14)}><tspan class="stat-value">${item.count}</tspan><tspan class="stat-label"> titles</tspan></text>
                <text class="stat-label" x="0" y="40" ${fitText(item.detail, 110, 12)}>${item.detail}</text>
              </g>`,
            )
            .join("")}
        </g>`
      : `<g data-testid="main-card-body" transform="translate(20, ${isMinimal ? 60 : 83})">
          ${metrics
            .map(
              (metric, index) => `
              <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - 150 + index * ANIMATION.FAST_INCREMENT}ms" transform="translate(${index * 67}, 0)">
                <text class="stat-value" x="0" y="0" ${fitText(metric.value, 60, 14)}>${metric.value}</text>
                <text class="metric-label" x="0" y="17">${metric.label}</text>
              </g>`,
            )
            .join("")}
        </g>`
  }
</svg>
`);
};
