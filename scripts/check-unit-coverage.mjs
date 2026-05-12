import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const DEFAULT_COVERAGE_REPORT_PATH = ".artifacts/coverage/lcov.info";
export const DEFAULT_COVERAGE_LINES_THRESHOLD = 73;

export function normalizeCoveragePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

export function shouldSkipCoverageRecord(filePath) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(normalizeCoveragePath(filePath));
}

export function resolveCoverageThreshold(rawThreshold) {
  const resolvedThreshold = Number(
    rawThreshold ?? String(DEFAULT_COVERAGE_LINES_THRESHOLD),
  );

  if (!Number.isFinite(resolvedThreshold)) {
    throw new Error(`Invalid COVERAGE_LINES_THRESHOLD: ${rawThreshold ?? ""}`);
  }

  return resolvedThreshold;
}

export function parseUnitCoverageReport(reportText) {
  let linesFound = 0;
  let linesHit = 0;
  let currentFile = null;

  for (const line of reportText.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      currentFile = line.slice(3);
      continue;
    }

    if (line.startsWith("LF:")) {
      if (currentFile && shouldSkipCoverageRecord(currentFile)) {
        continue;
      }

      linesFound += Number(line.slice(3));
      continue;
    }

    if (line.startsWith("LH:")) {
      if (currentFile && shouldSkipCoverageRecord(currentFile)) {
        continue;
      }

      linesHit += Number(line.slice(3));
      continue;
    }

    if (line === "end_of_record") {
      currentFile = null;
    }
  }

  if (linesFound === 0) {
    throw new Error("LCOV report did not include any executable lines.");
  }

  return {
    lineCoverage: (linesHit / linesFound) * 100,
    linesFound,
    linesHit,
  };
}

export function runUnitCoverageCheck(options = {}) {
  const reportPath = options.reportPath ?? DEFAULT_COVERAGE_REPORT_PATH;
  const threshold =
    options.threshold ??
    resolveCoverageThreshold(process.env.COVERAGE_LINES_THRESHOLD);
  const existsSyncFn = options.existsSyncFn ?? existsSync;
  const readFileSyncFn = options.readFileSyncFn ?? readFileSync;

  if (!existsSyncFn(reportPath)) {
    throw new Error(`Coverage report not found at ${reportPath}`);
  }

  const reportText = readFileSyncFn(reportPath, "utf8");
  const coverage = parseUnitCoverageReport(reportText);

  return {
    ...coverage,
    passed: coverage.lineCoverage >= threshold,
    reportPath,
    threshold,
  };
}

export function formatUnitCoverageSummary(result) {
  return `Line coverage (excluding *.test/spec files): ${result.lineCoverage.toFixed(2)}% (${result.linesHit}/${result.linesFound}); threshold: ${result.threshold.toFixed(2)}%`;
}

export function formatUnitCoverageFailure(result) {
  return `Coverage threshold not met: ${result.lineCoverage.toFixed(2)}% < ${result.threshold.toFixed(2)}%`;
}

export function main() {
  try {
    const result = runUnitCoverageCheck();
    console.log(formatUnitCoverageSummary(result));

    if (!result.passed) {
      console.error(formatUnitCoverageFailure(result));
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main();
}
