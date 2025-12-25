"use client";

import { useMemo } from "react";
import { cn, isGradient } from "@/lib/utils";
import type { ColorValue, GradientDefinition } from "@/lib/types/card";
import { animeStatsTemplate } from "@/lib/svg-templates/media-stats/anime-stats-template";
import { stripTrustedSvgMarker } from "@/lib/types/svg";

/**
 * Sample anime stats data used for the preview card.
 * These values provide a realistic preview of the anime stats card.
 * @source
 */
const SAMPLE_ANIME_STATS = {
  count: 142,
  episodesWatched: 2847,
  minutesWatched: 68328,
  meanScore: 78.5,
  standardDeviation: 12.3,
  previousMilestone: 2500,
  currentMilestone: 3000,
  dasharray: "251.33",
  dashoffset: "75.40",
} as const;

/**
 * Props for ColorPreviewCard component.
 * @source
 */
interface ColorPreviewCardProps {
  /** Title color (solid or gradient) */
  titleColor: ColorValue;
  /** Background color (solid or gradient) */
  backgroundColor: ColorValue;
  /** Text color (solid or gradient) */
  textColor: ColorValue;
  /** Circle/accent color (solid or gradient) */
  circleColor: ColorValue;
  /** Optional border color */
  borderColor?: string;
  /** Optional border radius in pixels */
  borderRadius?: number;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Converts a gradient definition to a CSS gradient string.
 * @param gradient - The gradient definition.
 * @returns CSS gradient string.
 * @source
 */
function gradientToCss(gradient: GradientDefinition): string {
  const stops = gradient.stops
    .map((stop) => {
      const opacity = stop.opacity ?? 1;
      if (opacity < 1) {
        // Convert hex to rgba
        const hex = stop.color.replace("#", "");
        const r = Number.parseInt(hex.substring(0, 2), 16);
        const g = Number.parseInt(hex.substring(2, 4), 16);
        const b = Number.parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity}) ${stop.offset}%`;
      }
      return `${stop.color} ${stop.offset}%`;
    })
    .join(", ");

  if (gradient.type === "linear") {
    return `linear-gradient(${gradient.angle ?? 90}deg, ${stops})`;
  }
  const cx = gradient.cx ?? 50;
  const cy = gradient.cy ?? 50;
  return `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`;
}

/**
 * Converts a ColorValue to a CSS-compatible color or gradient string.
 * @param value - The color value.
 * @returns CSS color string.
 * @source
 */
function colorValueToCss(value: ColorValue): string {
  if (isGradient(value)) {
    return gradientToCss(value);
  }
  return value;
}

/**
 * Renders a preview card showing the current color configuration
 * using the actual anime stats card template with sample data.
 * Displays the default variant of the anime stats card for realistic preview.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
export function ColorPreviewCard({
  titleColor,
  backgroundColor,
  textColor,
  circleColor,
  borderColor,
  borderRadius = 8,
  className,
}: Readonly<ColorPreviewCardProps>) {
  // Generate the actual anime stats card SVG with current colors
  const previewSvg = useMemo(() => {
    const svg = animeStatsTemplate({
      username: "Preview",
      variant: "default",
      styles: {
        titleColor,
        backgroundColor,
        textColor,
        circleColor,
        borderColor,
        borderRadius,
      },
      stats: SAMPLE_ANIME_STATS,
    });
    return stripTrustedSvgMarker(svg);
  }, [
    titleColor,
    backgroundColor,
    textColor,
    circleColor,
    borderColor,
    borderRadius,
  ]);

  // Memoize CSS values for color swatches
  const cssValues = useMemo(
    () => ({
      title: colorValueToCss(titleColor),
      background: colorValueToCss(backgroundColor),
      text: colorValueToCss(textColor),
      circle: colorValueToCss(circleColor),
    }),
    [titleColor, backgroundColor, textColor, circleColor],
  );

  // Check if values are gradients for swatch rendering
  const isGradientTitle = isGradient(titleColor);
  const isGradientBackground = isGradient(backgroundColor);
  const isGradientText = isGradient(textColor);
  const isGradientCircle = isGradient(circleColor);

  return (
    <div className={cn("flex flex-col items-center space-y-3", className)}>
      {/* Anime Stats Card Preview */}
      <div className="relative overflow-hidden shadow-lg transition-all">
        <div
          dangerouslySetInnerHTML={{ __html: previewSvg }}
          className="transition-all duration-200"
        />
      </div>

      {/* Color Swatches */}
      <div className="flex flex-wrap justify-center gap-1.5">
        <ColorSwatch
          label="Title"
          color={cssValues.title}
          isGradient={isGradientTitle}
        />
        <ColorSwatch
          label="Background"
          color={cssValues.background}
          isGradient={isGradientBackground}
        />
        <ColorSwatch
          label="Text"
          color={cssValues.text}
          isGradient={isGradientText}
        />
        <ColorSwatch
          label="Accent"
          color={cssValues.circle}
          isGradient={isGradientCircle}
        />
      </div>
    </div>
  );
}

/**
 * Props for ColorSwatch component.
 * @source
 */
interface ColorSwatchProps {
  /** Label for the color */
  label: string;
  /** CSS color or gradient string */
  color: string;
  /** Whether this is a gradient */
  isGradient: boolean;
}

/**
 * Renders a small labeled color swatch.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
function ColorSwatch({ label, color, isGradient }: Readonly<ColorSwatchProps>) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-slate-100/80 px-1.5 py-1 dark:bg-slate-700/50">
      <div
        className={cn(
          "h-3 w-3 shrink-0 rounded-sm border border-slate-300/50 shadow-sm dark:border-slate-600/50",
          isGradient && "ring-1 ring-purple-400/30",
        )}
        style={{ background: color }}
        title={isGradient ? `${label} (gradient)` : label}
      />
      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}
