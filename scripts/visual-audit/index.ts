/**
 * Command-line entry point for the visual audit.
 *
 * Kept separate from the capture and report modules so both can be imported
 * and exercised without going through `process.argv`, and so this file stays
 * small enough to read as the documentation for the tool: parse, run, print.
 *
 * Run with `bun run audit:capture` and `bun run audit:report`, or directly:
 * `bun run scripts/visual-audit/index.ts <action> [options]`.
 *
 * @source
 */

import path from "node:path";
import { runCapture } from "./capture";
import { runCompare } from "./compare";
import { parseCommand, resolveAuditPaths, USAGE_TEXT } from "./options";
import { writeReport } from "./report";

/** Repository root, resolved from this file rather than the working directory. @source */
const ROOT = path.resolve(import.meta.dir, "../..");

/**
 * Runs the requested action and prints the result.
 * @returns The process exit code.
 * @source
 */
async function main(): Promise<number> {
  const paths = resolveAuditPaths(ROOT);
  const command = parseCommand(process.argv.slice(2), paths);

  if (command.action === "help") {
    console.log(USAGE_TEXT);
    return 0;
  }

  if (command.action === "report") {
    const { output, index, summary } = writeReport(
      command.cardsDir,
      command.output,
    );
    console.log(
      `Report: ${output} (${summary.variations} captures, ${summary.failures} failed, ${summary.fallbacks} possible fallbacks)`,
    );
    console.log(`Index: ${index}`);
    return 0;
  }

  if (command.action === "compare") {
    runCompare(command.beforeDir, command.afterDir);
    return 0;
  }

  const { outputDir, manifest, failed } = await runCapture({
    userId: command.userId,
    style: command.style,
    outputDir: command.outputDir,
    force: command.force,
  });

  const fallbacks = manifest.captures.filter(
    (item) => item.fallbackIndicators.length,
  );
  console.log(
    `Rendered ${manifest.captures.length - failed.length}/${manifest.captures.length} variations to ${outputDir}`,
  );
  console.log(
    `Failed: ${failed.length}; possible fallbacks: ${fallbacks.length}`,
  );
  for (const item of failed) {
    console.error(`${item.card}/${item.variation}: ${item.error}`);
  }
  if (failed.length) return 1;

  console.log(`\nNext: bun run audit:report --dir "${outputDir}"`);
  return 0;
}

process.exitCode = await main();
