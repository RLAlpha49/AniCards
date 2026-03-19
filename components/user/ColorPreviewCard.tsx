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

  const {
    cssValues,
    isGradientTitle,
    isGradientBackground,
    isGradientText,
    isGradientCircle,
  } = useMemo(
    () => ({
      cssValues: {
        title: colorValueToCss(titleColor),
        background: colorValueToCss(backgroundColor),
        text: colorValueToCss(textColor),
        circle: colorValueToCss(circleColor),
      },
      isGradientTitle: isGradient(titleColor),
      isGradientBackground: isGradient(backgroundColor),
      isGradientText: isGradient(textColor),
      isGradientCircle: isGradient(circleColor),
    }),
    [titleColor, backgroundColor, textColor, circleColor],
  );

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative w-full overflow-hidden rounded-xl shadow-md ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-lg dark:ring-white/5">
        <div
          dangerouslySetInnerHTML={{ __html: previewSvg }}
          className="transition-all duration-200 [&>svg]:w-full"
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
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

interface ColorSwatchProps {
  label: string;
  color: string;
  isGradient: boolean;
}

function ColorSwatch({ label, color, isGradient }: Readonly<ColorSwatchProps>) {
  return (
    <div className="bg-muted/60 flex items-center gap-2 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
      <div
        className={cn(
          "h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 shadow-sm dark:border-white/10",
          isGradient &&
            "ring-gold/40 ring-offset-background ring-1 ring-offset-1",
        )}
        style={{ background: color }}
        title={isGradient ? `${label} (gradient)` : label}
      />
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
        {label}
      </span>
    </div>
  );
}
