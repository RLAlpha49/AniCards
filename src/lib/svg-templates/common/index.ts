/**
 * The shared SVG toolkit every template family renders from: spacing and type
 * scales, card dimensions, colour helpers, text fitting, bar rows, element
 * builders, and the background and stylesheet generators.
 *
 * Families import from here rather than from a sibling module, so moving a
 * helper does not reach them. The option types are named individually because
 * `./types` also re-exports `CardDimensions` from `./dimensions`, and a
 * wildcard would collide.
 *
 * @source
 */

export * from "./constants";
export * from "./dimensions";
export * from "./color-utils";
export * from "./text-metrics";
export * from "./bars";
export * from "./base-template-utils";
export * from "./style-generators";
export * from "./svg-primitives";

export type {
  StyleOptions,
  TextOptions,
  RectOptions,
  GroupOptions,
} from "./types";
