import { existsSync, readFileSync } from "node:fs";

const reportPath =
  process.env.COVERAGE_REPORT_PATH ?? ".artifacts/coverage/lcov.info";
const threshold = Number(process.env.COVERAGE_LINES_THRESHOLD ?? "72");

function normalizeCoveragePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function shouldSkipCoverageRecord(filePath) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(normalizeCoveragePath(filePath));
}

if (!Number.isFinite(threshold)) {
  console.error(
    `Invalid COVERAGE_LINES_THRESHOLD: ${process.env.COVERAGE_LINES_THRESHOLD ?? ""}`,
  );
  process.exit(1);
}

if (!existsSync(reportPath)) {
  console.error(`Coverage report not found at ${reportPath}`);
  process.exit(1);
}

let linesFound = 0;
let linesHit = 0;
let currentFile = null;

for (const line of readFileSync(reportPath, "utf8").split(/\r?\n/)) {
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
  console.error("LCOV report did not include any executable lines.");
  process.exit(1);
}

const lineCoverage = (linesHit / linesFound) * 100;

console.log(
  `Line coverage (excluding *.test/spec files): ${lineCoverage.toFixed(2)}% (${linesHit}/${linesFound}); threshold: ${threshold.toFixed(2)}%`,
);

if (lineCoverage < threshold) {
  console.error(
    `Coverage threshold not met: ${lineCoverage.toFixed(2)}% < ${threshold.toFixed(2)}%`,
  );
  process.exit(1);
}
