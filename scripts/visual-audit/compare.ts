/**
 * Compares two capture manifests.
 *
 * This is the reason captures are deterministic. A hash that changed between
 * two runs against the same record means the code changed, and this reports
 * which variations changed and how: same variation, different bytes (a real
 * difference), or missing on one side (a card was added or removed).
 *
 * The comparison is intentionally tolerant of the settings differing between
 * runs. Two captures in different styles will differ everywhere, and saying so
 * up front is more useful than reporting every variation as changed.
 *
 * @source
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Capture, Manifest } from "./types";

/** How one variation differs between two captures. @source */
type CaptureDiff = {
  card: string;
  variation: string;
  reason: "changed" | "added" | "removed";
};

/** The result of comparing two captures. @source */
type CompareResult = {
  /** Captures whose SVG changed, plus cards added or removed. */
  differences: CaptureDiff[];
  /** Variations present in both runs with identical bytes. */
  unchanged: number;
  /** Settings that differed, in a form worth printing. */
  settingChanges: string[];
};

/**
 * Reads a manifest from a capture directory.
 * @param cardsDir - Directory holding `manifest.json`.
 * @returns The parsed manifest.
 * @source
 */
function readManifest(cardsDir: string): Manifest {
  return JSON.parse(
    readFileSync(path.join(cardsDir, "manifest.json"), "utf8"),
  ) as Manifest;
}

/**
 * Keys captures by card and variation.
 * @param manifest - Capture manifest.
 * @returns A lookup of `${card}/${variation}` to its capture.
 * @source
 */
function indexByVariation(manifest: Manifest): Map<string, Capture> {
  return new Map(
    manifest.captures.map((capture) => [
      `${capture.card}/${capture.variation}`,
      capture,
    ]),
  );
}

/**
 * Lists the settings that differ between two runs.
 *
 * Reported separately from the per-variation diffs because a style change
 * explains a difference in every card, and a reviewer should not have to
 * infer that from hundreds of changed hashes.
 *
 * @param before - Earlier manifest.
 * @param after - Later manifest.
 * @returns One line per setting that changed.
 * @source
 */
function compareSettings(before: Manifest, after: Manifest): string[] {
  const changes: string[] = [];
  if (before.source.userId !== after.source.userId) {
    changes.push(
      `source user: ${before.source.userId} -> ${after.source.userId}`,
    );
  }
  if (before.fixedTime !== after.fixedTime) {
    changes.push(`frozen clock: ${before.fixedTime} -> ${after.fixedTime}`);
  }
  if (JSON.stringify(before.style) !== JSON.stringify(after.style)) {
    changes.push("style settings differ");
  }
  return changes;
}

/**
 * Compares two manifests by variation hash.
 *
 * @param before - The earlier manifest.
 * @param after - The later manifest.
 * @returns Differences, unchanged count, and setting changes.
 * @source
 */
function compareManifests(before: Manifest, after: Manifest): CompareResult {
  const oldCaptures = indexByVariation(before);
  const newCaptures = indexByVariation(after);
  const differences: CaptureDiff[] = [];
  let unchanged = 0;

  for (const [key, oldCapture] of oldCaptures) {
    const [card, variation] = key.split("/");
    const newCapture = newCaptures.get(key);
    if (!newCapture) {
      differences.push({ card, variation, reason: "removed" });
      continue;
    }
    if (oldCapture.sha256 === newCapture.sha256) unchanged += 1;
    else differences.push({ card, variation, reason: "changed" });
  }
  for (const [key, newCapture] of newCaptures) {
    if (oldCaptures.has(key)) continue;
    differences.push({
      card: newCapture.card,
      variation: newCapture.variation,
      reason: "added",
    });
  }

  return {
    differences,
    unchanged,
    settingChanges: compareSettings(before, after),
  };
}

/**
 * Compares two capture directories and prints a summary.
 *
 * Differences are the expected output, not a failure, so this always returns
 * 0 unless a manifest cannot be read. A caller that wants to gate on the
 * result can read `compareManifests` directly.
 *
 * @param beforeDir - Directory of the earlier capture.
 * @param afterDir - Directory of the later capture.
 * @source
 */
export function runCompare(beforeDir: string, afterDir: string): void {
  const result = compareManifests(
    readManifest(beforeDir),
    readManifest(afterDir),
  );

  if (result.settingChanges.length) {
    console.log("Settings that differ (these explain differences below):");
    for (const change of result.settingChanges) console.log(`  ${change}`);
    console.log("");
  }

  if (result.differences.length === 0) {
    console.log(`No differences: ${result.unchanged} variations identical.`);
    return;
  }

  const count = (reason: CaptureDiff["reason"]) =>
    result.differences.filter((diff) => diff.reason === reason).length;
  console.log(
    `${result.unchanged} unchanged, ${count("changed")} changed, ${count("added")} added, ${count("removed")} removed.`,
  );
  for (const diff of result.differences) {
    console.log(`  ${diff.reason.padEnd(8)} ${diff.card}/${diff.variation}`);
  }
}
