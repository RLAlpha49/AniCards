"use client";

import { type ReactNode, useEffect, useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Props for the inline loading spinner.
 * @property size - Visual size variant for the spinner: 'sm' | 'md' | 'lg'.
 * @property className - Optional className to adjust styling.
 * @property text - Accessible label or status text shown below the spinner.
 * @property progress - Optional progress percentage (0-100) to display as a progress ring.
 * @property showProgressLabel - Whether to show the progress percentage text.
 * @source
 */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  progress?: number;
  showProgressLabel?: boolean;
}

const sizeConfig = {
  sm: { box: "h-6 w-6", viewBox: 48, textClass: "text-[10px]" },
  md: { box: "h-10 w-10", viewBox: 48, textClass: "text-xs" },
  lg: { box: "h-16 w-16", viewBox: 48, textClass: "text-sm" },
} as const;

/**
 * A compact animated spinner with optional label and progress indicator.
 * @param props - Spinner props.
 * @returns A spinner element and optional label.
 * @source
 */
export function LoadingSpinner({
  size = "md",
  className,
  text,
  progress,
  showProgressLabel = false,
}: Readonly<LoadingSpinnerProps>) {
  const id = useId();
  const s = id.replaceAll(".", "-").replaceAll(":", "-");
  const cfg = sizeConfig[size];
  const hasProgress =
    progress !== undefined && progress >= 0 && progress <= 100;
  const cx = 24;
  const r1 = 18;
  const r2 = 14;
  const r3 = 10;
  const circumference1 = 2 * Math.PI * r1;
  const circumference2 = 2 * Math.PI * r2;
  const circumference3 = 2 * Math.PI * r3;

  return (
    <output
      aria-live="polite"
      aria-busy="true"
      className="inline-flex flex-col items-center gap-2.5"
    >
      <div className={cn(cfg.box, className, "relative")}>
        {/* Ambient glow behind the arcs */}
        <div className="absolute inset-[-25%] rounded-full bg-primary/10 blur-xl dark:bg-primary/15" />

        <svg
          className="relative size-full"
          viewBox={`0 0 ${cfg.viewBox} ${cfg.viewBox}`}
          aria-labelledby={`t-${s}`}
        >
          <title id={`t-${s}`}>{text ?? "Loading"}</title>

          <defs>
            {/* Outer arc gradient — warm gold sweep */}
            <linearGradient id={`g1-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(42, 63%, 55%)" />
              <stop offset="50%" stopColor="hsl(38, 50%, 48%)" />
              <stop
                offset="100%"
                stopColor="hsl(42, 63%, 55%)"
                stopOpacity="0.15"
              />
            </linearGradient>
            {/* Middle arc gradient — deeper amber */}
            <linearGradient id={`g2-${s}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(35, 58%, 45%)" />
              <stop offset="60%" stopColor="hsl(42, 70%, 58%)" />
              <stop
                offset="100%"
                stopColor="hsl(35, 58%, 45%)"
                stopOpacity="0.1"
              />
            </linearGradient>
            {/* Inner arc gradient — bright gold */}
            <linearGradient id={`g3-${s}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(45, 72%, 60%)" />
              <stop offset="50%" stopColor="hsl(42, 80%, 52%)" />
              <stop
                offset="100%"
                stopColor="hsl(45, 72%, 60%)"
                stopOpacity="0.2"
              />
            </linearGradient>

            {hasProgress && (
              <linearGradient
                id={`gp-${s}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="hsl(42, 63%, 55%)" />
                <stop offset="100%" stopColor="hsl(30, 58%, 42%)" />
              </linearGradient>
            )}
          </defs>

          {/* Faint track rings */}
          <circle
            cx={cx}
            cy={cx}
            r={r1}
            fill="none"
            stroke="hsl(42, 40%, 50%)"
            strokeWidth="1.2"
            strokeOpacity="0.08"
          />
          <circle
            cx={cx}
            cy={cx}
            r={r2}
            fill="none"
            stroke="hsl(42, 40%, 50%)"
            strokeWidth="1"
            strokeOpacity="0.06"
          />
          <circle
            cx={cx}
            cy={cx}
            r={r3}
            fill="none"
            stroke="hsl(42, 40%, 50%)"
            strokeWidth="0.8"
            strokeOpacity="0.05"
          />

          {/* Outer arc — slow elegant sweep */}
          <circle
            cx={cx}
            cy={cx}
            r={r1}
            fill="none"
            stroke={`url(#g1-${s})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${circumference1 * 0.3} ${circumference1 * 0.7}`}
            className="motion-safe:animate-[spin_3.2s_linear_infinite] motion-reduce:animate-none"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />

          {/* Middle arc — counter-rotating */}
          <circle
            cx={cx}
            cy={cx}
            r={r2}
            fill="none"
            stroke={`url(#g2-${s})`}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={`${circumference2 * 0.25} ${circumference2 * 0.75}`}
            className="
              motion-safe:animate-[spin_2.4s_linear_infinite_reverse]
              motion-reduce:animate-none
            "
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />

          {/* Inner arc — fastest, creates visual rhythm */}
          <circle
            cx={cx}
            cy={cx}
            r={r3}
            fill="none"
            stroke={`url(#g3-${s})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={`${circumference3 * 0.35} ${circumference3 * 0.65}`}
            className="motion-safe:animate-[spin_1.6s_linear_infinite] motion-reduce:animate-none"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />

          {/* Center dot — pulsing gold */}
          <circle
            cx={cx}
            cy={cx}
            r="2"
            fill="hsl(42, 63%, 55%)"
            className="
              motion-safe:animate-pulse motion-safe:animation-duration-[2s]
              motion-reduce:animate-none
            "
          />

          {/* Progress ring overlay when progress is provided */}
          {hasProgress && (
            <g
              style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
            >
              <circle
                cx={cx}
                cy={cx}
                r={r1}
                fill="none"
                stroke={`url(#gp-${s})`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * circumference1} ${circumference1}`}
                className="
                  transition-[stroke-dasharray] duration-500 ease-in-out
                  motion-reduce:transition-none
                "
              />
            </g>
          )}
        </svg>
      </div>

      {hasProgress && showProgressLabel && (
        <span
          className={cn(
            cfg.textClass,
            `
              font-display font-semibold text-primary
              motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0
            `,
          )}
        >
          {Math.round(progress)}%
        </span>
      )}

      {text && (
        <p
          className={cn(
            cfg.textClass,
            `
              font-body-serif tracking-wide text-muted-foreground
              motion-safe:animate-pulse motion-safe:animation-duration-[2.2s]
              motion-reduce:animate-none
            `,
          )}
        >
          {text}
        </p>
      )}
    </output>
  );
}

interface LoadingOverlayProps {
  text?: string;
  children?: ReactNode;
}

export function LoadingOverlay({
  text = "Generating your cards...",
  children,
}: Readonly<LoadingOverlayProps>) {
  useEffect(() => {
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return (
    <div className="
      fixed inset-0 z-1000 flex items-center justify-center bg-background/85 backdrop-blur-md
    ">
      <div className="pointer-events-none flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" text={text} />
        {children}
      </div>
    </div>
  );
}
