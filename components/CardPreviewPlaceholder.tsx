import type React from "react";

import { cn } from "@/lib/utils";

interface CardPreviewPlaceholderProps {
  className?: string;
  aspectRatio?: number;
  width?: number;
  height?: number;
  fixedDimensions?: boolean;
}

export function CardPreviewPlaceholder({
  className,
  aspectRatio,
  width,
  height,
  fixedDimensions = false,
}: Readonly<CardPreviewPlaceholderProps>) {
  const resolvedAspectRatio =
    aspectRatio ?? (width && height ? width / height : 16 / 9);
  const style: React.CSSProperties = {
    ...(resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}),
    ...(fixedDimensions && width
      ? {
          width,
          minWidth: width,
          maxWidth: width,
        }
      : {}),
    ...(fixedDimensions && height ? { height } : {}),
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-[hsl(var(--foreground)/0.02)]",
        className,
      )}
      style={style}
    >
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
