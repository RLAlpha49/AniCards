/**
 * Named audit styles and command-line parsing for the visual audit.
 *
 * A style is the set of rendering options every variation is captured with.
 * They are named and kept here rather than inline in the capture so that two
 * runs can be compared knowing exactly what differed, and so adding a style
 * does not mean editing the capture loop.
 *
 * The values feed `buildCardConfigFromParams`, the same function the card
 * route uses, so an audit style is expressed in the app's own vocabulary: a
 * named colour preset, individual colour overrides, and a border radius.
 *
 * @source
 */

import path from "node:path";
import type { AuditStyle } from "./types";

/**
 * Rendering settings shared by every named style.
 *
 * These match the generator's own defaults closely enough that a capture
 * looks like a real card: favourites and pie percentages on, a 3x2 grid.
 * @source
 */
const SHARED_STYLE = {
  showFavorites: true,
  showPiePercentages: true,
  gridCols: 3,
  gridRows: 2,
} as const;

/**
 * Styles an audit can be captured with.
 *
 * `solid` uses flat colours and is the default because it makes layout and
 * truncation problems easy to see. `gradient` and `light` exercise the colour
 * handling that flat dark colours hide.
 * @source
 */
export const AUDIT_STYLES: Record<string, AuditStyle> = {
  solid: {
    ...SHARED_STYLE,
    name: "solid",
    colors: {
      titleColor: "#d76f62",
      backgroundColor: "#17233a",
      textColor: "#f6ead8",
      circleColor: "#70b5ad",
      borderColor: "#d0a770",
    },
    borderRadius: 12,
  },
  gradient: {
    ...SHARED_STYLE,
    name: "gradient",
    colorPreset: "anilistDarkGradient",
    colors: { borderColor: "#d0a770" },
    borderRadius: 12,
  },
  light: {
    ...SHARED_STYLE,
    name: "light",
    colorPreset: "anilistLight",
    colors: { borderColor: "#3cc8ff" },
    borderRadius: 12,
  },
};

/**
 * Returns a style by name, or throws with the list of valid names.
 * @param name - Style name from the command line or the environment.
 * @returns The matching style.
 * @source
 */
function resolveAuditStyle(name: string): AuditStyle {
  const style = AUDIT_STYLES[name];
  if (!style) {
    throw new Error(
      `Unknown style "${name}". Available: ${Object.keys(AUDIT_STYLES).join(", ")}.`,
    );
  }
  return style;
}

/** Where an audit reads and writes when nothing else is specified. @source */
type AuditPaths = {
  root: string;
  auditDir: string;
  cardsDir: string;
  reportPath: string;
};

/**
 * Resolves the default directories from the repository root.
 * @param root - Repository root, resolved from this script's location.
 * @returns Absolute paths for captures and the report.
 * @source
 */
export function resolveAuditPaths(root: string): AuditPaths {
  const auditDir = path.join(root, "docs", "visual-audit");
  return {
    root,
    auditDir,
    cardsDir: path.join(auditDir, "cards"),
    reportPath: path.join(auditDir, "report.html"),
  };
}

/** A parsed invocation. @source */
export type Command =
  | {
      action: "capture";
      outputDir: string;
      style: AuditStyle;
      userId: string;
      force: boolean;
    }
  | { action: "report"; cardsDir: string; output: string }
  | { action: "compare"; beforeDir: string; afterDir: string }
  | { action: "help" };

const USAGE = `Usage: bun run audit:capture [options]
       bun run audit:report [options]

Or directly: bun run scripts/visual-audit/cli.ts <action> [options]

Actions:
  capture                 Render every registered card variation.
  report                  Rebuild the HTML report from a previous capture.
  compare <before> <after>
                          Compare two captures by SVG hash.

Capture options:
  --output-dir <path>     Write captures here (default: docs/visual-audit/cards).
  --user <id>             AniList user id to read (default: VISUAL_AUDIT_USER_ID or 542244).
  --style <name>          Rendering style (solid, gradient, light; default: solid).
  --force                 Replace an existing capture directory.

Report options:
  --dir <path>            Capture directory to read (default: docs/visual-audit/cards).
  --output <path>         Report path (default: docs/visual-audit/report.html).

  -h, --help              Show this message.`;

/**
 * Reads the value that follows a flag.
 * @param argv - Remaining arguments.
 * @param index - Index of the flag.
 * @param flag - Flag name, for the error message.
 * @returns The value after the flag.
 * @source
 */
function valueAfter(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} needs a value.\n\n${USAGE}`);
  }
  return value;
}

/**
 * Parses the command line into a single action.
 *
 * Unknown flags are an error rather than ignored: a typo in `--style` should
 * not silently produce a second capture in the default style.
 *
 * @param argv - Arguments after the script name.
 * @param paths - Default locations.
 * @returns The action to run.
 * @source
 */
export function parseCommand(argv: string[], paths: AuditPaths): Command {
  const [action = "capture", ...rest] = argv;
  if (action === "-h" || action === "--help" || action === "help") {
    return { action: "help" };
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    return { action: "help" };
  }
  if (action === "compare") {
    const [beforeDir, afterDir, ...extra] = rest;
    if (!beforeDir || !afterDir || extra.length) {
      throw new Error(`compare needs two directories.\n\n${USAGE}`);
    }
    return {
      action: "compare",
      beforeDir: path.resolve(beforeDir),
      afterDir: path.resolve(afterDir),
    };
  }

  let outputDir = paths.cardsDir;
  let styleName = "solid";
  let userId = process.env.VISUAL_AUDIT_USER_ID ?? "542244";
  let force = false;
  let reportOutput = paths.reportPath;
  let reportDir = paths.cardsDir;

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--force") {
      force = true;
      continue;
    }
    if (flag === "--output-dir") {
      outputDir = path.resolve(valueAfter(rest, index, flag));
      index += 1;
      continue;
    }
    if (flag === "--user") {
      userId = valueAfter(rest, index, flag);
      index += 1;
      continue;
    }
    if (flag === "--style") {
      styleName = valueAfter(rest, index, flag);
      index += 1;
      continue;
    }
    if (flag === "--dir") {
      reportDir = path.resolve(valueAfter(rest, index, flag));
      index += 1;
      continue;
    }
    if (flag === "--output") {
      reportOutput = path.resolve(valueAfter(rest, index, flag));
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${flag}.\n\n${USAGE}`);
  }

  if (action === "capture") {
    return {
      action: "capture",
      outputDir,
      style: resolveAuditStyle(styleName),
      userId,
      force,
    };
  }
  if (action === "report") {
    return { action: "report", cardsDir: reportDir, output: reportOutput };
  }
  throw new Error(`Unknown action: ${action}.\n\n${USAGE}`);
}

/** The usage text, so the entry point can print it for `--help`. @source */
export const USAGE_TEXT = USAGE;
