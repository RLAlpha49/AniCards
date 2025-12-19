import type { CardDimensions } from "@/lib/svg-templates/common/types";

export function generateCardBackground(
  dims: CardDimensions,
  cardRadius: number,
  resolvedColors: Record<string, string>,
): string {
  return `
    <rect
      data-testid="card-bg"
      x="0.5"
      y="0.5"
      rx="${cardRadius}"
      height="${dims.h - 1}"
      width="${dims.w - 1}"
      fill="${resolvedColors.backgroundColor}"
      ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
      stroke-width="2"
    />
  `;
}

export function calculateAnimationDelay(
  baseDelay: number,
  index: number,
  increment: number,
): string {
  return `${baseDelay + index * increment}ms`;
}
