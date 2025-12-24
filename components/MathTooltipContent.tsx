"use client";

import { useMemo } from "react";
import katex from "katex";

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
  const renderedContent = useMemo(() => {
    return renderMathContent(content);
  }, [content]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}

/**
 * Renders a content string, converting LaTeX math delimiters to KaTeX HTML.
 * Handles both display math ($$...$$) and inline math ($...$).
 *
 * @param content - The content string with potential LaTeX formulas
 * @returns HTML string with rendered math
 */
function renderMathContent(content: string): string {
  // First, process display math ($$...$$)
  const withDisplayMath = content.replaceAll(
    /\$\$([^$]+)\$\$/g,
    (_, formula: string) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          output: "html",
        });
      } catch {
        return `$$${formula}$$`;
      }
    },
  );

  // Then, process inline math ($...$)
  return withDisplayMath.replaceAll(/\$([^$\n]+)\$/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        output: "html",
      });
    } catch {
      return `$${formula}$`;
    }
  });
}

/**
 * Checks if content contains any LaTeX math delimiters.
 *
 * @param content - The content string to check
 * @returns True if content contains math delimiters
 */
export function containsMath(content: string): boolean {
  return /\$[^$]+\$/.test(content);
}
