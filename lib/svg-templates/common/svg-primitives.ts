import { escapeForXml } from "@/lib/utils";
import type {
  GroupOptions,
  RectOptions,
  TextOptions,
} from "@/lib/svg-templates/common/types";

export function createTextElement(
  x: number,
  y: number,
  text: string,
  className: string,
  options?: TextOptions,
): string {
  const attrs: string[] = [`x="${x}"`, `y="${y}"`];
  if (className) attrs.push(`class="${className}"`);
  if (options?.fill) attrs.push(`fill="${options.fill}"`);
  if (typeof options?.fontSize === "number")
    attrs.push(`font-size="${options.fontSize}"`);
  if (typeof options?.fontWeight === "number")
    attrs.push(`font-weight="${options.fontWeight}"`);
  if (options?.textAnchor) attrs.push(`text-anchor="${options.textAnchor}"`);

  return `<text ${attrs.join(" ")}>${escapeForXml(text)}</text>`;
}

export function createRectElement(
  x: number,
  y: number,
  width: number,
  height: number,
  options?: RectOptions,
): string {
  const attrs: string[] = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${width}"`,
    `height="${height}"`,
  ];
  if (typeof options?.rx === "number") attrs.push(`rx="${options.rx}"`);
  if (options?.fill) attrs.push(`fill="${options.fill}"`);
  if (options?.stroke) attrs.push(`stroke="${options.stroke}"`);
  if (typeof options?.strokeWidth === "number")
    attrs.push(`stroke-width="${options.strokeWidth}"`);
  if (typeof options?.opacity === "number")
    attrs.push(`opacity="${options.opacity}"`);
  if (options?.className) attrs.push(`class="${options.className}"`);

  return `<rect ${attrs.join(" ")} />`;
}

export function createGroupElement(
  transform: string,
  content: string,
  options?: GroupOptions,
): string {
  const attrs: string[] = [];
  if (transform) attrs.push(`transform="${transform}"`);
  if (options?.className) attrs.push(`class="${options.className}"`);
  if (options?.dataTestId) attrs.push(`data-testid="${options.dataTestId}"`);
  if (options?.animationDelay)
    attrs.push(`style="animation-delay:${options.animationDelay}"`);

  return `<g ${attrs.join(" ")}>${content}</g>`;
}

export function createStaggeredGroup(
  transform: string,
  content: string,
  animationDelay: string,
): string {
  return createGroupElement(transform, content, {
    className: "stagger",
    animationDelay,
  });
}
