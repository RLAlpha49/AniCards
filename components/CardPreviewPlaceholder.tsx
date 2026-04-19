import type React from "react";

import { cn } from "@/lib/utils";

interface CardPreviewPlaceholderProps {
  className?: string;
  aspectRatio?: number;
  width?: number;
  height?: number;
  fixedDimensions?: boolean;
}

function getPlaceholderViewport(opts: {
  aspectRatio?: number;
  width?: number;
  height?: number;
}) {
  if (opts.width && opts.height) {
    return {
      height: opts.height,
      width: opts.width,
    };
  }

  const resolvedAspectRatio =
    opts.aspectRatio ??
    (opts.width && opts.height ? opts.width / opts.height : 16 / 9);
  const viewportWidth = 1000;
  const viewportHeight = Math.max(
    1,
    Math.round(viewportWidth / resolvedAspectRatio),
  );

  return {
    height: viewportHeight,
    width: viewportWidth,
  };
}

export function CardPreviewPlaceholder({
  className,
  aspectRatio,
  width,
  height,
  fixedDimensions = false,
}: Readonly<CardPreviewPlaceholderProps>) {
  const viewport = getPlaceholderViewport({
    aspectRatio,
    width,
    height,
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-[4px] bg-[hsl(var(--foreground)/0.02)]",
        fixedDimensions ? "inline-block" : "w-full",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        role="presentation"
        className={cn(
          "block",
          fixedDimensions ? "h-auto max-w-none" : "h-auto w-full",
        )}
        width={fixedDimensions ? viewport.width : undefined}
        height={fixedDimensions ? viewport.height : undefined}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          width={viewport.width}
          height={viewport.height}
          fill="transparent"
        />
      </svg>
      <div className="
        absolute inset-0
        bg-[linear-gradient(135deg,hsl(var(--gold)/0.08),transparent_42%,hsl(var(--foreground)/0.04))]
      " />
      <div className="
        absolute inset-x-[12%] top-[16%] h-px bg-linear-to-r from-transparent
        via-[hsl(var(--gold)/0.25)] to-transparent
      " />
      <div className="
        absolute inset-x-[18%] top-[28%] h-[18%] rounded-md border border-[hsl(var(--gold)/0.1)]
        bg-[hsl(var(--foreground)/0.04)]
      " />
      <div className="absolute inset-x-[12%] bottom-[16%] space-y-2">
        <div className="h-2.5 w-[58%] rounded-full bg-[hsl(var(--foreground)/0.08)]" />
        <div className="h-2.5 w-[42%] rounded-full bg-[hsl(var(--foreground)/0.06)]" />
      </div>
      <div className="
        absolute -top-10 right-[18%] size-24 rounded-full bg-[hsl(var(--gold)/0.08)] blur-3xl
      " />
      <div className="
        absolute -bottom-8 left-[12%] size-20 rounded-full bg-[hsl(var(--foreground)/0.08)] blur-3xl
      " />
      <div className="
        absolute inset-0 animate-pulse
        bg-[linear-gradient(90deg,transparent,hsl(var(--foreground)/0.03),transparent)]
      " />
    </div>
  );
}
