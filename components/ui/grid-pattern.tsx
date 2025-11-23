"use client";

import { type CSSProperties, useMemo } from "react";
import { cn } from "@/lib/utils";

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

type RangeTuple = [number, number];

const DEFAULT_OPACITY_RANGE: RangeTuple = [0.35, 0.8];
const DEFAULT_ROTATION_RANGE: RangeTuple = [-12, 12];
const DEFAULT_SCALE_RANGE: RangeTuple = [0.92, 1.12];

interface GradientStyle {
  id: string;
  className: string;
  minSize: number;
  maxSize: number;
  transform: string;
  opacityRange?: RangeTuple;
  rotationRange?: RangeTuple;
  scaleRange?: RangeTuple;
  mixBlendMode?: CSSProperties["mixBlendMode"];
}

interface PositionedBlob extends GradientStyle {
  width: number;
  height: number;
  topValue: number;
  leftValue: number;
  opacity: number;
  rotation: number;
  scale: number;
}

const GRADIENT_STYLES: GradientStyle[] = [
  {
    id: "main-blue",
    className: "bg-blue-400/10 blur-[120px] dark:bg-blue-600/10",
    minSize: 600,
    maxSize: 900,
    transform: "translate(-50%, -50%)",
    opacityRange: [0.55, 0.85],
    rotationRange: [-6, 6],
    scaleRange: [0.92, 1],
    mixBlendMode: "soft-light",
  },
  {
    id: "main-purple",
    className: "bg-purple-400/10 blur-[100px] dark:bg-purple-600/10",
    minSize: 500,
    maxSize: 750,
    transform: "translate(0, 0)",
    opacityRange: [0.45, 0.75],
    rotationRange: [-10, 10],
    scaleRange: [0.95, 1.05],
    mixBlendMode: "soft-light",
  },
  {
    id: "main-pink",
    className: "bg-pink-400/10 blur-[100px] dark:bg-pink-600/10",
    minSize: 500,
    maxSize: 750,
    transform: "translate(0, 0)",
    opacityRange: [0.45, 0.75],
    rotationRange: [-8, 8],
    scaleRange: [1, 1.08],
    mixBlendMode: "soft-light",
  },
];

const ACCENT_STYLES: GradientStyle[] = [
  {
    id: "accent-blue",
    className: "bg-blue-100 blur-[100px] dark:bg-blue-900/20",
    minSize: 400,
    maxSize: 600,
    transform: "translate(0, 0)",
    opacityRange: [0.32, 0.6],
    rotationRange: [-6, 6],
    scaleRange: [1.02, 1.2],
    mixBlendMode: "screen",
  },
  {
    id: "accent-purple",
    className: "bg-purple-100 blur-[100px] dark:bg-purple-900/20",
    minSize: 400,
    maxSize: 600,
    transform: "translate(0, 0)",
    opacityRange: [0.25, 0.5],
    rotationRange: [-10, 10],
    scaleRange: [1.1, 1.3],
    mixBlendMode: "screen",
  },
];

const RADIAL_OVERLAY_GRADIENTS = [
  "radial-gradient(circle at 15% 20%, rgba(59,130,246,0.45) 0%, transparent 55%)",
  "radial-gradient(circle at 80% 30%, rgba(236,72,153,0.4) 0%, transparent 45%)",
  "radial-gradient(circle at 40% 80%, rgba(168,85,247,0.35) 0%, transparent 50%)",
];
const RADIAL_OVERLAY_BACKGROUND = RADIAL_OVERLAY_GRADIENTS.join(", ");

const MIN_DISTANCE = 24;
const DEFAULT_TOP_RANGE: RangeTuple = [-20, 80];
const DEFAULT_LEFT_RANGE: RangeTuple = [-20, 120];

function generateGradientBlobs(
  count: number,
  styles: GradientStyle[],
  topRange: RangeTuple = DEFAULT_TOP_RANGE,
  leftRange: RangeTuple = DEFAULT_LEFT_RANGE,
  minDistance = MIN_DISTANCE,
): PositionedBlob[] {
  const blobs: PositionedBlob[] = [];
  let attempts = 0;

  while (blobs.length < count && attempts < count * 30) {
    const style = styles[blobs.length % styles.length];
    const topValue = randomBetween(topRange[0], topRange[1]);
    const leftValue = randomBetween(leftRange[0], leftRange[1]);

    const [minOpacity, maxOpacity] =
      style.opacityRange ?? DEFAULT_OPACITY_RANGE;
    const [minRotation, maxRotation] =
      style.rotationRange ?? DEFAULT_ROTATION_RANGE;
    const [minScale, maxScale] = style.scaleRange ?? DEFAULT_SCALE_RANGE;

    const candidate: PositionedBlob = {
      ...style,
      width: Math.round(randomBetween(style.minSize, style.maxSize)),
      height: Math.round(randomBetween(style.minSize, style.maxSize)),
      topValue,
      leftValue,
      opacity: randomBetween(minOpacity, maxOpacity),
      rotation: randomBetween(minRotation, maxRotation),
      scale: randomBetween(minScale, maxScale),
    };

    const isTooClose = blobs.some((existing) => {
      const deltaX = existing.leftValue - candidate.leftValue;
      const deltaY = existing.topValue - candidate.topValue;
      return Math.hypot(deltaX, deltaY) < minDistance;
    });

    if (!isTooClose) {
      blobs.push(candidate);
    }

    attempts += 1;
  }

  return blobs;
}

export function GridPattern({
  className,
  includeGradients = true,
  gradientCount = 3,
}: Readonly<{
  className?: string;
  includeGradients?: boolean;
  gradientCount?: number;
}>) {
  const mainBlobs = useMemo(
    () =>
      includeGradients
        ? generateGradientBlobs(gradientCount, GRADIENT_STYLES)
        : [],
    [gradientCount, includeGradients],
  );
  const accentBlobs = useMemo(
    () =>
      includeGradients
        ? generateGradientBlobs(2, ACCENT_STYLES, [-20, 70], [-40, 120], 18)
        : [],
    [includeGradients],
  );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
      {includeGradients && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: RADIAL_OVERLAY_BACKGROUND,
              mixBlendMode: "screen",
              opacity: 0.15,
            }}
          />
          {mainBlobs.map((blob, index) => (
            <div
              key={`${blob.id}-${index}`}
              className={`absolute rounded-full ${blob.className}`}
              style={{
                width: `${blob.width}px`,
                height: `${blob.height}px`,
                top: `${blob.topValue}%`,
                left: `${blob.leftValue}%`,
                transform: `${blob.transform} rotate(${blob.rotation}deg) scale(${blob.scale})`,
                opacity: blob.opacity,
                mixBlendMode: blob.mixBlendMode,
              }}
            />
          ))}
          <div className="pointer-events-none absolute inset-0 opacity-30">
            {accentBlobs.map((blob, index) => (
              <div
                key={`${blob.id}-accent-${index}`}
                className={`absolute rounded-full ${blob.className}`}
                style={{
                  width: `${blob.width}px`,
                  height: `${blob.height}px`,
                  top: `${blob.topValue}%`,
                  left: `${blob.leftValue}%`,
                  transform: `${blob.transform} rotate(${blob.rotation}deg) scale(${blob.scale})`,
                  opacity: blob.opacity,
                  mixBlendMode: blob.mixBlendMode,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
