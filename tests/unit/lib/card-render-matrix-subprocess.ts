import { mockPretextStressUserRecord } from "@/tests/e2e/fixtures/pretext-stress-data";
import {
  CARD_RENDER_MATRIX_CASE_COUNT,
  cardRenderMatrixCases,
  createCardRenderMatrixConfig,
} from "@/tests/shared/card-render-matrix";

const TRUSTED_SVG_PREFIX = "<!--ANICARDS_TRUSTED_SVG-->";

function getRootNumericAttribute(
  svg: string,
  attribute: "width" | "height",
): number {
  const match = new RegExp(
    String.raw`<svg[^>]*\s${attribute}\s*=\s*(["'])([^"']+)\1`,
  ).exec(svg);
  const rawValue = match?.[2]?.trim();

  if (!rawValue) {
    throw new Error(
      `Missing root svg ${attribute} attribute. SVG snippet: ${svg.slice(0, 240)}`,
    );
  }

  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(
      `Invalid root svg ${attribute} attribute value "${rawValue}". SVG snippet: ${svg.slice(0, 240)}`,
    );
  }

  return parsedValue;
}

/** Subprocess entry point for the card render matrix harness; returns Promise<void> and prints JSON caseCount/failures to stdout. */
export async function main(): Promise<void> {
  const { default: generateCardSvg } = await import("@/lib/card-generator");

  const failures: string[] = [];
  const containsMarkupNumericSentinel = (
    svg: string,
    sentinel: "NaN" | "Infinity",
  ): boolean => new RegExp(`(?:=["']${sentinel}["']|>${sentinel}<)`).test(svg);

  for (const matrixCase of cardRenderMatrixCases) {
    const svg = await generateCardSvg(
      createCardRenderMatrixConfig(matrixCase.cardId, matrixCase.variation),
      mockPretextStressUserRecord,
      matrixCase.variation,
      undefined,
      { animationsEnabled: false },
    );
    const caseLabel = `${matrixCase.cardId}:${matrixCase.variation}`;

    if (!svg.startsWith(TRUSTED_SVG_PREFIX)) {
      failures.push(`${caseLabel} missing trusted SVG prefix`);
      continue;
    }

    if (!svg.includes("<svg")) {
      failures.push(`${caseLabel} missing root svg element`);
      continue;
    }

    let width = 0;
    let height = 0;

    try {
      width = getRootNumericAttribute(svg, "width");
      height = getRootNumericAttribute(svg, "height");
    } catch (error) {
      failures.push(
        `${caseLabel} malformed root attributes: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (width <= 0) {
      failures.push(`${caseLabel} has invalid width: ${width}`);
    }

    if (height <= 0) {
      failures.push(`${caseLabel} has invalid height: ${height}`);
    }

    if (containsMarkupNumericSentinel(svg, "NaN")) {
      failures.push(`${caseLabel} contains NaN`);
    }

    if (containsMarkupNumericSentinel(svg, "Infinity")) {
      failures.push(`${caseLabel} contains Infinity`);
    }

    if (svg.includes('="undefined"') || svg.includes(">undefined<")) {
      failures.push(`${caseLabel} contains undefined markup`);
    }
  }

  console.log(
    JSON.stringify({
      caseCount: CARD_RENDER_MATRIX_CASE_COUNT,
      failures,
    }),
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
