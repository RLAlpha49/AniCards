import type { TrustedSVG } from "@/lib/types/svg";
import type { UserAvatar, UserStatistics } from "@/lib/types/records";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
  toFiniteNumber,
} from "@/lib/utils";
import {
  generateCardBackground,
  generateCommonStyles,
  type TemplateStyles,
} from "./shared";

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

  const dims = { w: 300, h: 170 };
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Profile`;
  const safeTitle = escapeForXml(title);
  const safeUsername = escapeForXml(data.username);

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
    ${generateCommonStyles(
      resolvedColors,
      Number.parseFloat(calculateDynamicFontSize(title)),
    )}

    .username {
      fill: ${resolvedColors.titleColor};
      font: 700 18px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .avatar-clip {
      clip-path: circle(30px at 35px 35px);
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  ${(() => {
    // Default variant
    return `
      <g data-testid="card-title" transform="translate(100, 45)">
        <text x="0" y="0" class="header">${safeUsername}</text>
      </g>
      ${
        avatarUrl
          ? `
        <g transform="translate(20, 10)">
          <clipPath id="avatar-clip">
            <circle cx="30" cy="30" r="30"/>
          </clipPath>
          <image
            x="0" y="0" width="60" height="60"
            ${hrefAttr}
            clip-path="url(#avatar-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle cx="30" cy="30" r="30" fill="none" stroke="${resolvedColors.circleColor}" stroke-width="2"/>
        </g>
      `
          : ""
      }
      <g data-testid="main-card-body" transform="translate(20, 100)">
        <g class="stagger" style="animation-delay: 300ms">
          <text class="section-title" x="0" y="0">ANIME</text>
          <text class="stat-value" x="0" y="20">${animeStats.count}</text>
          <text class="stat-label" x="50" y="20">titles</text>
          <text class="stat-label" x="0" y="40">${daysWatched} days watched</text>
        </g>
        <g class="stagger" style="animation-delay: 450ms" transform="translate(150, 0)">
          <text class="section-title" x="0" y="0">MANGA</text>
          <text class="stat-value" x="0" y="20">${mangaStats.count}</text>
          <text class="stat-label" x="50" y="20">titles</text>
          <text class="stat-label" x="0" y="40">${mangaStats.chaptersRead} chapters read</text>
        </g>
        ${
          yearsActive
            ? `
          <g class="stagger" style="animation-delay: 600ms" transform="translate(300, 0)">
            <text class="section-title" x="0" y="0">ACTIVE</text>
            <text class="stat-value" x="0" y="20">${yearsActive}</text>
            <text class="stat-label" x="30" y="20">year${yearSuffix}</text>
          </g>
        `
            : ""
        }
      </g>
    `;
  })()}
</svg>
`);
};
