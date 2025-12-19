import type { TrustedSVG } from "../../types/svg";
import type { UserFavourites } from "../../types/records";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "../../utils";
import { getVariantLabel, type TemplateStyles } from "./shared";
import { generateCommonStyles } from "../common/style-generators";
import { generateCardBackground } from "../common/base-template-utils";
import { ANIMATION, TYPOGRAPHY } from "../common/constants";

/**
 * Renders the Favourites Grid card - displays the user's favourite anime, manga,
 * or characters as a visual grid with cover images.
 * @param data - Template input including username, styles, favourites, and grid type.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const favoritesGridTemplate = (data: {
  username: string;
  variant?: "anime" | "manga" | "characters" | "mixed";
  styles: TemplateStyles;
  favourites: UserFavourites;
  gridCols?: number;
  gridRows?: number;
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

  // Select which favourites to show based on variant
  const variant = data.variant || "mixed";

  // Grid size (clamped to 1..5)
  const gridCols = Math.max(1, Math.min(5, Math.floor(data.gridCols ?? 3)));
  const gridRows = Math.max(1, Math.min(5, Math.floor(data.gridRows ?? 3)));
  const gridCapacity = gridCols * gridRows;

  type GridItem = {
    id: number;
    name: string;
    image?: string;
    color?: string;
    type: "anime" | "manga" | "character";
  };

  type GridCell = {
    kind: "item" | "placeholder";
    item?: GridItem;
    placeholderId: string;
  };

  const buildAnimeItems = (): GridItem[] => {
    const animeNodes = data.favourites.anime?.nodes ?? [];
    return animeNodes.map((n) => ({
      id: n.id,
      name: n.title.english || n.title.romaji || n.title.native || "Unknown",
      image: n.coverImage.large || n.coverImage.medium,
      color: n.coverImage.color,
      type: "anime" as const,
    }));
  };

  const buildMangaItems = (): GridItem[] => {
    const mangaNodes = data.favourites.manga?.nodes ?? [];
    return mangaNodes.map((n) => ({
      id: n.id,
      name: n.title.english || n.title.romaji || n.title.native || "Unknown",
      image: n.coverImage.large || n.coverImage.medium,
      color: n.coverImage.color,
      type: "manga" as const,
    }));
  };

  const buildCharacterItems = (): GridItem[] => {
    const charNodes = data.favourites.characters?.nodes ?? [];
    return charNodes.map((n) => ({
      id: n.id,
      name: n.name.full || n.name.native || "Unknown",
      image: n.image.large || n.image.medium,
      type: "character" as const,
    }));
  };

  const takeInterleavedMixed = (
    anime: GridItem[],
    manga: GridItem[],
    characters: GridItem[],
    limit: number,
  ): GridItem[] => {
    // Round-robin across pools until we hit `limit` or all pools are empty.
    const pools: GridItem[][] = [[...anime], [...manga], [...characters]];
    const result: GridItem[] = [];

    let poolIndex = 0;
    while (result.length < limit) {
      const before = result.length;
      for (let i = 0; i < pools.length && result.length < limit; i++) {
        const pool = pools[(poolIndex + i) % pools.length];
        const next = pool.shift();
        if (next) result.push(next);
      }
      poolIndex = (poolIndex + 1) % pools.length;
      if (result.length === before) break;
    }

    return result;
  };

  let gridItems: GridItem[] = [];

  if (variant === "anime") {
    gridItems = buildAnimeItems().slice(0, gridCapacity);
  } else if (variant === "manga") {
    gridItems = buildMangaItems().slice(0, gridCapacity);
  } else if (variant === "characters") {
    gridItems = buildCharacterItems().slice(0, gridCapacity);
  } else {
    // mixed
    gridItems = takeInterleavedMixed(
      buildAnimeItems(),
      buildMangaItems(),
      buildCharacterItems(),
      gridCapacity,
    );
  }

  // Always render a full grid; if items are missing, fill with placeholders.
  const cells: GridCell[] = Array.from({ length: gridCapacity }, (_, idx) => {
    const item = gridItems[idx];
    if (item) {
      return { kind: "item", item, placeholderId: `cell-${idx}` };
    }
    return { kind: "placeholder", placeholderId: `placeholder-${idx}` };
  });

  // Grid layout: configurable columns x rows
  const cellWidth = 120;
  const cellHeight = 190;
  const spacing = 12;
  const cols = gridCols;
  const rows = gridRows;

  const dims = {
    w: 20 + cols * (cellWidth + spacing) + 10,
    h: 55 + rows * (cellHeight + spacing) + 10,
  };
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const variantLabel = getVariantLabel(variant);
  const title =
    variant === "mixed"
      ? `${data.username}'s ${variantLabel}`
      : `${data.username}'s Favorite ${variantLabel}`;
  const safeTitle = escapeForXml(title);

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
    ${escapeForXml(
      `${variantLabel}: ${gridItems.map((item) => item.name).join(", ") || "None"}.`,
    )}
  </desc>

  <style>
    ${generateCommonStyles(
      resolvedColors,
      Number.parseFloat(calculateDynamicFontSize(title)),
    )}

    .item-name {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.SECTION_TITLE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .item-placeholder {
      fill: ${resolvedColors.circleColor};
      opacity: 0.3;
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  <g data-testid="card-title" transform="translate(20, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>

  <g data-testid="main-card-body" transform="translate(20, 50)">
    ${(() => {
      return cells
        .map((cell, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * (cellWidth + spacing);
          const y = row * (cellHeight + spacing);

          if (cell.kind === "placeholder" || !cell.item) {
            return `
            <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - ANIMATION.STAGGER_INCREMENT + i * ANIMATION.MEDIUM_INCREMENT}ms" transform="translate(${x}, ${y})">
              <clipPath id="clip-${cell.placeholderId}">
                <rect x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
              </clipPath>
              <rect class="item-placeholder" x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
            </g>
          `;
          }

          const item = cell.item;
          const anilistUrl = `https://anilist.co/${item.type}/${item.id}`;
          let imageHrefAttr = "";
          if (item.image) {
            imageHrefAttr = `xlink:href="${escapeForXml(item.image)}"`;
            if (item.image.startsWith("data:")) {
              imageHrefAttr = `href="${escapeForXml(item.image)}"`;
            }
          }

          const clipId = `clip-${item.type}-${item.id}-${i}`;

          return `
          <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - ANIMATION.STAGGER_INCREMENT + i * ANIMATION.MEDIUM_INCREMENT}ms" transform="translate(${x}, ${y})">
            <clipPath id="${clipId}">
              <rect x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
            </clipPath>
            ${
              item.image
                ? `
              <a xlink:href="${escapeForXml(anilistUrl)}" target="_blank">
                <image
                  x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}"
                  ${imageHrefAttr}
                  clip-path="url(#${clipId})"
                  preserveAspectRatio="xMidYMid slice"
                />
              </a>
            `
                : `
              <rect class="item-placeholder" x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
            `
            }
            <text class="item-name" style="font-size:${TYPOGRAPHY.LARGE_TEXT_SIZE}px" x="0" y="${cellHeight - 3}">
              ${escapeForXml(
                item.name.length > 15
                  ? item.name.substring(0, 15) + "…"
                  : item.name,
              )}
            </text>
          </g>
        `;
        })
        .join("");
    })()}
  </g>
</svg>
`);
};
