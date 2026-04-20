"use client";

import { type SVGProps, useId } from "react";

import type {
  ColorValue,
  GradientDefinition,
  GradientStop,
} from "@/lib/types/card";
import {
  cn,
  getGradientRenderFallbackColor,
  isGradient,
  sanitizeGradientForSvg,
} from "@/lib/utils";

type ColorValueSwatchProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  value: ColorValue;
  shape?: "rect" | "circle";
  cornerRadius?: number;
  title?: string;
};

function renderGradientStops(stops: GradientStop[]) {
  return stops.map((stop, index) => (
    <stop
      key={`${stop.offset}-${stop.color}-${index}`}
      offset={`${stop.offset}%`}
      stopColor={stop.color}
      stopOpacity={stop.opacity}
    />
  ));
}

function renderGradientDefinition(
  gradient: GradientDefinition,
  gradientId: string,
) {
  if (gradient.type === "linear") {
    const angle = gradient.angle ?? 0;
    const angleRad = ((angle - 90) * Math.PI) / 180;
    const x1 = Math.round(50 + Math.sin(angleRad + Math.PI) * 50);
    const y1 = Math.round(50 + Math.cos(angleRad + Math.PI) * 50);
    const x2 = Math.round(50 + Math.sin(angleRad) * 50);
    const y2 = Math.round(50 + Math.cos(angleRad) * 50);

    return (
      <linearGradient
        id={gradientId}
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
      >
        {renderGradientStops(gradient.stops)}
      </linearGradient>
    );
  }

  return (
    <radialGradient
      id={gradientId}
      cx={`${gradient.cx ?? 50}%`}
      cy={`${gradient.cy ?? 50}%`}
      r={`${gradient.r ?? 50}%`}
    >
      {renderGradientStops(gradient.stops)}
    </radialGradient>
  );
}

function getColorValueSwatchFill(options: {
  gradientId: string;
  sanitizedGradient: GradientDefinition | null;
  value: ColorValue;
}): string {
  if (options.sanitizedGradient) {
    return `url(#${options.gradientId})`;
  }

  if (typeof options.value === "string") {
    return options.value;
  }

  return getGradientRenderFallbackColor(options.value, "#000000");
}

export function ColorValueSwatch({
  className,
  cornerRadius = 0,
  preserveAspectRatio = "none",
  shape = "rect",
  title,
  value,
  ...props
}: Readonly<ColorValueSwatchProps>) {
  const idBase = useId().replaceAll(":", "");
  const gradientId = `${idBase}-gradient`;
  const titleId = `${idBase}-title`;
  const sanitizedGradient = isGradient(value)
    ? sanitizeGradientForSvg(value)
    : null;
  const fill = getColorValueSwatchFill({
    gradientId,
    sanitizedGradient,
    value,
  });

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio={preserveAspectRatio}
      className={cn("block", className)}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {sanitizedGradient ? (
        <defs>{renderGradientDefinition(sanitizedGradient, gradientId)}</defs>
      ) : null}
      {shape === "circle" ? (
        <circle cx="50" cy="50" r="50" fill={fill} />
      ) : (
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          rx={cornerRadius}
          ry={cornerRadius}
          fill={fill}
        />
      )}
    </svg>
  );
}
