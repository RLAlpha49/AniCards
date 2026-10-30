"use client";

import { useId } from "react";

/**
 * Seigaiha (青海波) scallop geometry for the section dividers.
 *
 * Three rows of concentric arcs hang from a hairline rule, each row offset by
 * half a tile so the fans interlock. Arcs are generated once at module load and
 * repeated through an SVG pattern, so the divider is a single small tile at any
 * viewport width.
 * @source
 */
const SEIGAIHA = (() => {
  const radius = 34;
  const rowGap = radius / 2;
  const tileWidth = radius * 2;
  const rows = 3;
  const rings = [1, 0.72, 0.44, 0.18];
  const paths: string[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = row * rowGap;
    const offset = (row % 2) * radius;

    for (let x = offset - tileWidth; x <= tileWidth + offset; x += tileWidth) {
      for (const ring of rings) {
        const r = Number((radius * ring).toFixed(2));
        paths.push(`M${x - r} ${y}a${r} ${r} 0 0 0 ${2 * r} 0`);
      }
    }
  }

  // The tile must be tall enough for the lowest row's outermost arc, otherwise
  // the pattern clips it and the fans lose their bottom edge.
  const tileHeight = (rows - 1) * rowGap + radius;

  return { paths, tileWidth, tileHeight };
})();

type SeigaihaDividerProps = Readonly<{
  /** Sizing and colour class supplied by the page. */
  className?: string;
}>;

/**
 * Hairline rule with the seigaiha scallop pattern hanging from it.
 *
 * The SVG has no viewBox, so the tile keeps its true pixel size instead of
 * stretching with the viewport; a mask fades the band into the paper below.
 *
 * @param props.className - Sizing and colour class supplied by the page.
 * @source
 */
export function SeigaihaDivider({ className }: SeigaihaDividerProps) {
  const dividerId = useId();

  return (
    <div className={className} aria-hidden="true">
      <svg focusable="false">
        <defs>
          <pattern
            id={`${dividerId}-tile`}
            width={SEIGAIHA.tileWidth}
            height={SEIGAIHA.tileHeight}
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            >
              {SEIGAIHA.paths.map((d, index) => (
                <path key={index} d={d} />
              ))}
            </g>
          </pattern>

          {/* The band dissolves into the paper below, so it reads as a printed
              rule rather than a hard edge. */}
          <linearGradient id={`${dividerId}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.06" stopColor="#fff" />
            <stop offset="0.92" stopColor="#000" />
          </linearGradient>
          <mask id={`${dividerId}-mask`}>
            <rect width="100%" height="100%" fill={`url(#${dividerId}-fade)`} />
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={`url(#${dividerId}-tile)`}
          opacity="0.8"
          mask={`url(#${dividerId}-mask)`}
        />
        <rect width="100%" height="1" fill="currentColor" opacity="0.55" />
      </svg>
    </div>
  );
}
