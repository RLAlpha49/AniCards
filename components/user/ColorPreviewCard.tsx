"use client";

import { useMemo } from "react";

import { gradientToCss } from "@/lib/colorUtils";
import { animeStatsTemplate } from "@/lib/svg-templates/media-stats/anime-stats-template";
import type { ColorValue } from "@/lib/types/card";
import { stripTrustedSvgMarker, type TrustedSVG } from "@/lib/types/svg";
import { cn, DEFAULT_CARD_BORDER_RADIUS, isGradient } from "@/lib/utils";

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

interface ColorPreviewCardProps {
  titleColor: ColorValue;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  circleColor: ColorValue;
  borderColor?: string;
  borderRadius?: number;
  className?: string;
}

function colorValueToCss(value: ColorValue): string {
  if (isGradient(value)) {
    return gradientToCss(value);
  }
  return value;
}

const SWATCH_CONFIG = [
  { key: "title", label: "Title" },
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "circle", label: "Accent" },
] as const;

export function ColorPreviewCard({
  titleColor,
  backgroundColor,
  textColor,
  circleColor,
  borderColor,
  borderRadius = DEFAULT_CARD_BORDER_RADIUS,
  className,
}: Readonly<ColorPreviewCardProps>) {
  const previewSvg = useMemo<string>(() => {
    const svg: TrustedSVG = animeStatsTemplate({
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

  const swatchData = useMemo(() => {
    const colors: Record<string, ColorValue> = {
      title: titleColor,
      background: backgroundColor,
      text: textColor,
      circle: circleColor,
    };
    return SWATCH_CONFIG.map(({ key, label }) => ({
      label,
      css: colorValueToCss(colors[key]),
      gradient: isGradient(colors[key]),
    }));
  }, [titleColor, backgroundColor, textColor, circleColor]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold tracking-[0.2em] text-gold uppercase">
          Preview
        </span>
        <span className="h-px flex-1 bg-linear-to-r from-gold/30 to-transparent" />
      </div>

      {/* Card mockup — isolated from parent backdrop-blur */}
      <div className="relative isolate mx-auto w-full max-w-md transform-[translateZ(0)]">
        {/* Ambient glow behind the card */}
        <div
          className="
            pointer-events-none absolute -inset-3 -z-10 rounded-2xl bg-gold/4 opacity-50 blur-2xl
            dark:bg-gold/6
          "
          aria-hidden="true"
        />

        {/* Card frame */}
        <div className="
          relative overflow-hidden rounded-lg shadow-lg ring-1 shadow-black/8 ring-gold/15
          transition-shadow duration-300
          hover:shadow-xl hover:shadow-gold/5
          dark:shadow-black/30 dark:ring-gold/20
          dark:hover:shadow-gold/8
        ">
          {/* Top accent bar */}
          <div
            className="h-px bg-linear-to-r from-transparent via-gold/50 to-transparent"
            aria-hidden="true"
          />

          {/* SVG container — GPU-composited, crisp text */}
          <div
            dangerouslySetInnerHTML={{ __html: previewSvg }}
            className="
              transform-[translateZ(0)] will-change-transform
              [&>svg]:block [&>svg]:w-full [&>svg]:[-webkit-font-smoothing:antialiased]
              [&>svg_text]:[text-rendering:optimizeLegibility]
            "
          />

          {/* Bottom accent bar */}
          <div
            className="h-px bg-linear-to-r from-transparent via-gold/50 to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Color swatches */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {swatchData.map(({ label, css, gradient }) => (
          <ColorSwatch
            key={label}
            label={label}
            color={css}
            isGradient={gradient}
          />
        ))}
      </div>
    </div>
  );
}

interface ColorSwatchProps {
  label: string;
  color: string;
  isGradient: boolean;
}

function ColorSwatch({ label, color, isGradient }: Readonly<ColorSwatchProps>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
        "border-border/40 bg-muted/40",
        "hover:border-gold/30 hover:bg-gold/5",
      )}
    >
      <div
        className={cn(
          "size-2.5 shrink-0 rounded-full shadow-sm",
          "ring-1 ring-black/10 dark:ring-white/10",
          isGradient && "ring-gold/40",
        )}
        style={{ background: color }}
        title={isGradient ? `${label} (gradient)` : label}
      />
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground/80">
        {label}
      </span>
    </div>
  );
}
