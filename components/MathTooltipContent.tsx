"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import katex from "katex";

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
    const html = renderMathContent(content);
    // Sanitize to prevent XSS from any malicious content
    return DOMPurify.sanitize(html);
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
    MATH_BLOCK_REGEX,
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
  return withDisplayMath.replaceAll(MATH_INLINE_REGEX, (_, formula: string) => {
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
  return MATH_DETECT_REGEX.test(content);
}
