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
    throw new TypeError(
      `Missing root svg ${attribute} attribute. SVG snippet: ${svg.slice(0, 240)}`,
    );
  }

  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new TypeError(
      `Invalid root svg ${attribute} attribute value "${rawValue}". SVG snippet: ${svg.slice(0, 240)}`,
    );
  }

  return parsedValue;
}

function getCaseLabel(
  matrixCase: (typeof cardRenderMatrixCases)[number],
): string {
  return `${matrixCase.cardId}:${matrixCase.variation}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function containsMarkupNumericSentinel(
  svg: string,
  sentinel: "NaN" | "Infinity",
): boolean {
  return new RegExp(`(?:=["']${sentinel}["']|>${sentinel}<)`).test(svg);
}

function containsUndefinedMarkup(svg: string): boolean {
  return svg.includes('="undefined"') || svg.includes(">undefined<");
}

function getSvgStructureFailure(caseLabel: string, svg: string): string | null {
  if (!svg.startsWith(TRUSTED_SVG_PREFIX)) {
    return `${caseLabel} missing trusted SVG prefix`;
  }

  if (!svg.includes("<svg")) {
    return `${caseLabel} missing root svg element`;
  }

  return null;
}

function getRootDimensions(
  caseLabel: string,
  svg: string,
): { width: number; height: number } | { failure: string } {
  try {
    return {
      width: getRootNumericAttribute(svg, "width"),
      height: getRootNumericAttribute(svg, "height"),
    };
  } catch (error) {
    return {
      failure: `${caseLabel} malformed root attributes: ${getErrorMessage(error)}`,
    };
  }
}

function getDimensionFailures(
  caseLabel: string,
  width: number,
  height: number,
): string[] {
  const failures: string[] = [];

  if (width <= 0) {
    failures.push(`${caseLabel} has invalid width: ${width}`);
  }

  if (height <= 0) {
    failures.push(`${caseLabel} has invalid height: ${height}`);
  }

  return failures;
}

function getMarkupFailures(caseLabel: string, svg: string): string[] {
  const failures: string[] = [];

  if (containsMarkupNumericSentinel(svg, "NaN")) {
    failures.push(`${caseLabel} contains NaN`);
  }

  if (containsMarkupNumericSentinel(svg, "Infinity")) {
    failures.push(`${caseLabel} contains Infinity`);
  }

  if (containsUndefinedMarkup(svg)) {
    failures.push(`${caseLabel} contains undefined markup`);
  }

  return failures;
}

function collectSvgFailures(caseLabel: string, svg: string): string[] {
  const structureFailure = getSvgStructureFailure(caseLabel, svg);
  if (structureFailure) {
    return [structureFailure];
  }

  const rootDimensions = getRootDimensions(caseLabel, svg);
  if ("failure" in rootDimensions) {
    return [rootDimensions.failure];
  }

  return [
    ...getDimensionFailures(
      caseLabel,
      rootDimensions.width,
      rootDimensions.height,
    ),
    ...getMarkupFailures(caseLabel, svg),
  ];
}

/** Subprocess entry point for the card render matrix harness; returns Promise<void> and prints JSON caseCount/failures to stdout. */
export async function main(): Promise<void> {
  const { default: generateCardSvg } = await import("@/lib/card-generator");

  const failures: string[] = [];

  for (const matrixCase of cardRenderMatrixCases) {
    const svg = await generateCardSvg(
      createCardRenderMatrixConfig(matrixCase.cardId, matrixCase.variation),
      mockPretextStressUserRecord,
      matrixCase.variation,
      undefined,
      { animationsEnabled: false },
    );
    failures.push(...collectSvgFailures(getCaseLabel(matrixCase), svg));
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
