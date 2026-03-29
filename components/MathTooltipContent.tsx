"use client";

import { lazy, Suspense } from "react";

/* Regex patterns to detect and render LaTeX math delimiters.
 * - MATH_BLOCK_REGEX: matches display math ($$...$$) with capture group for the formula (global for replace use).
 * - MATH_INLINE_REGEX: matches inline math ($...$) with capture group for the formula (global for replace use).
 * - MATH_DETECT_REGEX: non-global combined regex for use with `test()` to avoid stateful `lastIndex` side effects.
 */
const MATH_BLOCK_REGEX = /\$\$([\s\S]*?)\$\$/g;
const MATH_INLINE_REGEX = /(?<!\d)\$([^$\n]+?)\$(?!\d)/g;
const MATH_DETECT_REGEX = /\$\$[\s\S]+?\$\$|(?<!\d)\$[^$\n]+\$(?!\d)/;

/**
 * Props for MathTooltipContent component.
 * @source
 */
interface MathTooltipContentProps {
  /** Content string that may contain LaTeX math formulas */
  content: string;
  /** Optional className for styling */
  className?: string;
}

let mathTooltipRendererPromise: Promise<{
  default: typeof import("./MathTooltipContentRenderer").default;
}> | null = null;

function loadMathTooltipRenderer() {
  mathTooltipRendererPromise ??= import("./MathTooltipContentRenderer");

  return mathTooltipRendererPromise;
}

const LazyMathTooltipRenderer = lazy(loadMathTooltipRenderer);

function MathTooltipFallback({
  content,
  className,
}: Readonly<MathTooltipContentProps>) {
  return <p className={className}>{content}</p>;
}

export function prefetchMathTooltipContent(): void {
  void loadMathTooltipRenderer();
}

/**
 * Renders content with LaTeX math formulas using KaTeX.
 * Supports both inline math ($...$) and display/block math ($$...$$).
 *
 * @param props - Component props
 * @returns JSX element with rendered math formulas
 * @source
 */
export function MathTooltipContent({
  content,
  className,
}: Readonly<MathTooltipContentProps>) {
  return (
    <Suspense
      fallback={<MathTooltipFallback content={content} className={className} />}
    >
      <LazyMathTooltipRenderer content={content} className={className} />
    </Suspense>
  );
}

export type { MathTooltipContentProps };
export { MATH_BLOCK_REGEX, MATH_INLINE_REGEX };

/**
 * Checks if content contains any LaTeX math delimiters.
 *
 * @param content - The content string to check
 * @returns True if content contains math delimiters
 */
export function containsMath(content: string): boolean {
  return MATH_DETECT_REGEX.test(content);
}
