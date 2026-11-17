/**
 * Renders every registered card variation from one real stored account.
 *
 * The output is a directory of SVGs plus a `manifest.json`. The manifest is
 * the audit's actual product: the SVGs prove what was drawn, and the manifest
 * records the inputs, the settings, and anything that looked like a fallback,
 * so a later run can be compared against this one.
 *
 * Card configuration comes from `buildCardConfigFromParams`, which the card
 * route also uses, so what the audit renders is what the app renders for the
 * same query. Rendering happens inside `withControlledRender`, which freezes
 * the clock, blocks the network, and seeds randomness.
 *
 * @source
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { buildCardConfigFromParams } from "@/lib/card-data/config";
import { imageDataUrlCache } from "@/lib/image-utils";
import type { CardEntry, VariationDef } from "@/lib/cards/registry";
import {
  findFallbackIndicators,
  hasRemoteImage,
  isCompleteSvg,
} from "./indicators";
import type { AuditStyle, Capture, Manifest } from "./types";
import { hashSvg, withControlledRender } from "./render";
import {
  countFavorites,
  loadRealUserRecord,
  primeImageCache,
  realFavoriteNames,
} from "./real-data";

/** Options for one capture run. @source */
export type CaptureOptions = {
  /** AniList user id whose record drives every card. */
  userId: string;
  /** Rendering settings shared by every variation. */
  style: AuditStyle;
  /** Directory the SVGs and manifest are written to. */
  outputDir: string;
  /** When false, an existing output directory is left untouched. */
  force: boolean;
};

/**
 * Reads a variation id and its extras from a registry entry.
 *
 * The registry allows a bare string for a plain variation and an object when
 * the variation carries query parameters (status colours), so both forms are
 * normalised here rather than in the capture loop.
 *
 * @param definition - One registry variation.
 * @returns The variation id and its extras.
 * @source
 */
function readVariation(definition: VariationDef): {
  variation: string;
  extras: Record<string, string>;
} {
  return typeof definition === "string"
    ? { variation: definition, extras: {} }
    : { variation: definition.variation, extras: { ...definition.extras } };
}

/**
 * Builds the card config for one variation.
 *
 * Both the registry extras and the audit style are expressed as the query
 * parameters the card route accepts, then handed to the same builder the
 * route uses. That keeps the audit honest: if the route's parameter handling
 * changes, the audit follows without being edited.
 *
 * `statusColors` is the one extras key the registry currently uses, and it
 * only means anything for the status distribution cards, so it is mapped to
 * the parameter and everything else is left to the builder's defaults.
 *
 * @param card - Registry entry for the card.
 * @param variation - Variation id being rendered.
 * @param extras - Query parameters the variation inherits.
 * @param style - Audit rendering settings.
 * @returns The stored-config shape the renderer accepts.
 * @source
 */
function buildConfig(
  card: CardEntry,
  variation: string,
  extras: Record<string, string>,
  style: AuditStyle,
) {
  return buildCardConfigFromParams({
    cardType: card.id,
    baseCardType: card.id,
    variationParam: variation,
    showFavoritesParam: String(style.showFavorites),
    statusColorsParam: extras.statusColors ?? null,
    piePercentagesParam: String(style.showPiePercentages),
    gridColsParam: String(style.gridCols),
    gridRowsParam: String(style.gridRows),
    colorPresetParam: style.colorPreset ?? null,
    titleColorParam: style.colors.titleColor ?? null,
    backgroundColorParam: style.colors.backgroundColor ?? null,
    textColorParam: style.colors.textColor ?? null,
    circleColorParam: style.colors.circleColor ?? null,
    borderColorParam: style.colors.borderColor ?? null,
    borderRadiusParam: String(style.borderRadius),
  });
}

/**
 * Throws unless a name is safe to use as a file name.
 *
 * Both parts come from the registry rather than user input, but the check is
 * what lets the report build a path from the manifest without trusting it.
 *
 * @param cardId - Card id.
 * @param variation - Variation id.
 * @source
 */
function assertSafeName(cardId: string, variation: string): void {
  if (!/^\w+$/.test(cardId) || !/^[\w-]+$/.test(variation)) {
    throw new Error(`Unsafe card or variation name: ${cardId}/${variation}`);
  }
}

/**
 * Resolves the instant the capture clock freezes at.
 *
 * Anchored to the record rather than a hardcoded date. Activity windows and
 * "days since" figures are measured against `now`, so a stale clock renders
 * the wrong range and can place real activity in the future.
 *
 * @param record - The stored record being audited.
 * @returns The instant to freeze at, in milliseconds.
 * @source
 */
function resolveAnchor(record: {
  dataUpdatedAt?: string;
  updatedAt?: string;
}): number {
  const source = record.dataUpdatedAt ?? record.updatedAt;
  if (!source) {
    throw new Error(
      "Record has no dataUpdatedAt or updatedAt, so the capture clock cannot be anchored.",
    );
  }
  const anchor = Date.parse(source);
  if (Number.isNaN(anchor)) {
    throw new Error(`Record has no usable timestamp: ${source}`);
  }
  return anchor;
}

/**
 * Prepares the output directory.
 *
 * A capture is never merged into an existing one. A second run over the same
 * directory would leave SVGs the new manifest does not list, and those look
 * current to anyone browsing the folder.
 *
 * `--force` deletes the directory, but only once it is confirmed to be a
 * capture directory (it holds a `manifest.json`) or is empty. The alternative,
 * deleting whatever path was passed, turns a mistyped `--output-dir` into data
 * loss.
 *
 * @param outputDir - Requested destination.
 * @param force - Whether an existing capture may be replaced.
 * @throws When the directory exists, `force` is set, and it is not a capture.
 * @source
 */
function prepareOutputDir(outputDir: string, force: boolean): void {
  mkdirSync(path.dirname(outputDir), { recursive: true });

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
    return;
  }
  if (!force) {
    throw new Error(
      `${outputDir} already exists. Pass --force to replace it, or --output-dir to keep both.`,
    );
  }

  const entries = readdirSync(outputDir);
  const looksLikeCapture = entries.includes("manifest.json");
  if (entries.length > 0 && !looksLikeCapture) {
    throw new Error(
      `Refusing to delete ${outputDir}: it is not empty and holds no manifest.json, so it is probably not a capture directory. Delete it yourself if that is what you meant.`,
    );
  }
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir);
}

/**
 * Host of the Redis the audit read from, for the manifest.
 * @returns The host, or `unknown` when the variable is unset or unparsable.
 * @source
 */
function redisHost(): string {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return "unknown";
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

/**
 * Describes what the capture does and does not cover.
 *
 * Built from the settings actually used, so the caveat cannot claim a scope
 * wider or narrower than the run had.
 *
 * @param style - The style the run used.
 * @returns Caveat sentences for the manifest.
 * @source
 */
function buildCaveats(style: AuditStyle): string[] {
  const colours = style.colorPreset
    ? `the ${style.colorPreset} preset`
    : "solid colours";
  return [
    "The record is a point-in-time copy: titles, counts, and artwork change whenever the account is refreshed, so captures are not reproducible across refreshes.",
    `One style is captured (${colours}, ${style.gridCols}x${style.gridRows} favourites grid). Run the capture again with another style to cover other colours.`,
    "Cover art is embedded as a base64 data URL, so these files are large and carry whatever artwork the account had at capture time.",
    "Identical outputs and detected placeholder text are indicators, not proof of a variation fallback or complete coverage.",
  ];
}

/** Everything one capture produced. @source */
export type CaptureResult = {
  outputDir: string;
  manifest: Manifest;
  failed: Capture[];
};

/**
 * Renders every registered variation and writes the manifest.
 *
 * @param options - What to capture and where.
 * @returns A summary the caller reports.
 * @source
 */
export async function runCapture(
  options: CaptureOptions,
): Promise<CaptureResult> {
  prepareOutputDir(options.outputDir, options.force);

  // The record is read before the clock and network are replaced: the read
  // needs Redis over the network, and a frozen clock would make every cache
  // entry look expired.
  const record = await loadRealUserRecord(options.userId);
  if (!record) {
    throw new Error(
      `No stored record for user ${options.userId}. Seed one and retry, or pass --user with an id that exists.`,
    );
  }

  const anchorMs = resolveAnchor(record);
  console.log(
    `Source user: ${record.username} (${options.userId}), ${countFavorites(record)} favourites`,
  );

  const uncached = await primeImageCache(record);
  console.log(
    `Images: ${imageDataUrlCache.size} cached, ${uncached.length} unavailable`,
  );

  // Imported after the environment is controlled, so module-level state in
  // the renderer cannot capture the real clock or the real `fetch`.
  const [{ CARD_REGISTRY }, { generateCardSvg }, { toCleanSvgResponse }] =
    await Promise.all([
      import("@/lib/cards/registry"),
      import("@/lib/card-generator"),
      import("@/lib/types/svg"),
    ]);

  const captures: Capture[] = [];
  const seenHashes = new Map<string, string>();

  await withControlledRender(anchorMs, async (guard) => {
    for (const card of CARD_REGISTRY) {
      for (const definition of card.variations) {
        const { variation, extras } = readVariation(definition);
        const result: Capture = {
          card: card.id,
          variation,
          extras,
          fallbackIndicators: [],
        };
        captures.push(result);

        const attemptsBefore = guard.networkAttempts();
        guard.reseed();
        try {
          assertSafeName(card.id, variation);
          const config = buildConfig(card, variation, extras, options.style);
          const svg = toCleanSvgResponse(
            await generateCardSvg(
              config,
              record,
              variation,
              realFavoriteNames(record, card.id),
            ),
          );

          if (guard.networkAttempts() !== attemptsBefore) {
            throw new Error("Renderer attempted network access");
          }
          if (!isCompleteSvg(svg)) {
            throw new Error("Renderer did not return an SVG");
          }
          if (hasRemoteImage(svg)) {
            throw new Error("SVG contains a remote image");
          }

          result.fallbackIndicators.push(...findFallbackIndicators(svg));
          result.bytes = Buffer.byteLength(svg);
          result.sha256 = hashSvg(svg);

          // Two variations of one card producing identical bytes usually means
          // the variation name was ignored and both fell back to the same
          // layout, which no visual review would catch.
          const duplicateKey = `${card.id}:${result.sha256}`;
          result.identicalTo = seenHashes.get(duplicateKey);
          seenHashes.set(duplicateKey, result.identicalTo ?? variation);

          result.file = `${card.id}--${variation}.svg`;
          writeFileSync(path.join(options.outputDir, result.file), svg, {
            flag: "wx",
          });
        } catch (error) {
          result.error =
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : String(error);
          delete result.file;
          delete result.sha256;
          delete result.bytes;
        }
      }
    }
  });

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    fixedTime: new Date(anchorMs).toISOString(),
    timezone: "UTC",
    source: {
      userId: String(options.userId),
      username: String(record.username ?? ""),
      redisHost: redisHost(),
    },
    style: options.style,
    caveats: buildCaveats(options.style),
    captures,
  };

  writeFileSync(
    path.join(options.outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );

  return {
    outputDir: options.outputDir,
    manifest,
    failed: captures.filter((item) => item.error),
  };
}
