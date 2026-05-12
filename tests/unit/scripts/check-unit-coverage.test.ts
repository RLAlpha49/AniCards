import { describe, expect, it } from "bun:test";

import {
  formatUnitCoverageFailure,
  formatUnitCoverageSummary,
  normalizeCoveragePath,
  parseUnitCoverageReport,
  resolveCoverageThreshold,
  runUnitCoverageCheck,
  shouldSkipCoverageRecord,
} from "../../../scripts/check-unit-coverage.mjs";

describe("check-unit-coverage", () => {
  it("normalizes Windows-style paths before skipping test files", () => {
    expect(normalizeCoveragePath("tests\\unit\\example.spec.ts")).toBe(
      "tests/unit/example.spec.ts",
    );
    expect(shouldSkipCoverageRecord("tests\\unit\\example.spec.ts")).toBe(true);
    expect(shouldSkipCoverageRecord("src/lib/example.ts")).toBe(false);
  });

  it("rejects an invalid coverage threshold", () => {
    expect(() => resolveCoverageThreshold("not-a-number")).toThrow(
      /Invalid COVERAGE_LINES_THRESHOLD/i,
    );
  });

  it("fails when the coverage report is missing", () => {
    expect(() =>
      runUnitCoverageCheck({
        existsSyncFn: () => false,
        reportPath: ".artifacts/coverage/missing.info",
        threshold: 73,
      }),
    ).toThrow(/Coverage report not found/i);
  });

  it("fails when the report only contains skipped test files", () => {
    expect(() =>
      parseUnitCoverageReport(
        [
          "SF:tests\\unit\\scripts\\check-unit-coverage.test.ts",
          "LF:20",
          "LH:20",
          "end_of_record",
        ].join("\n"),
      ),
    ).toThrow(/did not include any executable lines/i);
  });

  it("parses mixed path styles and reports below-threshold coverage", () => {
    const result = runUnitCoverageCheck({
      existsSyncFn: () => true,
      readFileSyncFn: () =>
        [
          "SF:src\\lib\\alpha.ts",
          "LF:50",
          "LH:40",
          "end_of_record",
          "SF:src/lib/beta.ts",
          "LF:50",
          "LH:40",
          "end_of_record",
          "SF:tests/unit/lib/alpha.test.ts",
          "LF:100",
          "LH:100",
          "end_of_record",
        ].join("\n"),
      threshold: 90,
    });

    expect(result.linesFound).toBe(100);
    expect(result.linesHit).toBe(80);
    expect(result.lineCoverage).toBe(80);
    expect(result.passed).toBe(false);
    expect(formatUnitCoverageSummary(result)).toContain("80.00% (80/100)");
    expect(formatUnitCoverageFailure(result)).toContain("80.00% < 90.00%");
  });

  it("passes when executable-source coverage meets the threshold", () => {
    const result = runUnitCoverageCheck({
      existsSyncFn: () => true,
      readFileSyncFn: () =>
        ["SF:src/lib/gamma.ts", "LF:25", "LH:25", "end_of_record"].join("\n"),
      threshold: 73,
    });

    expect(result.passed).toBe(true);
    expect(formatUnitCoverageSummary(result)).toContain("100.00% (25/25)");
  });
});
