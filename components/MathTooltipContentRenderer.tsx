"use client";

import "katex/dist/katex.min.css";

import DOMPurify from "dompurify";
import katex from "katex";
import { useMemo } from "react";

import {
  MATH_BLOCK_REGEX,
  MATH_INLINE_REGEX,
  type MathTooltipContentProps,
} from "./MathTooltipContent";

/**
 * Renders a content string, converting LaTeX math delimiters to KaTeX HTML.
 * Handles both display math ($$...$$) and inline math ($...$).
 *
 * @param content - The content string with potential LaTeX formulas
 * @returns HTML string with rendered math
 */
function renderMathContent(content: string): string {
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

export default function MathTooltipContentRenderer({
  content,
  className,
}: Readonly<MathTooltipContentProps>) {
  const renderedContent = useMemo(() => {
    const html = renderMathContent(content);
    // Sanitize to prevent XSS from any malicious content.
    return DOMPurify.sanitize(html);
  }, [content]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
