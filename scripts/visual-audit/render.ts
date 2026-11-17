/**
 * The controlled environment the audit renders cards in.
 *
 * Three things have to be taken away from the renderer for a capture to mean
 * anything:
 *
 * 1. **The clock.** Several cards measure activity windows and "days since"
 *    against `now`. A real clock makes every capture differ from the last.
 * 2. **The network.** Rendering must be provably offline, otherwise a card
 *    could quietly depend on a live request.
 * 3. **Unseeded randomness.** SVG ids are randomised; without a seed, two
 *    renders of the same card differ byte-for-byte and hashes are useless.
 *
 * The random seed is reset per card rather than per run, so a card's ids
 * depend on its own content and not on its position in the registry.
 *
 * @source
 */

import { createHash } from "node:crypto";

/** Live access to what the render did that it should not have. @source */
export type RenderGuard = {
  /** Total blocked network attempts so far. */
  networkAttempts: () => number;
  /** Reseeds the random generator, so each card starts from the same state. */
  reseed: () => void;
};

/** Seed used for every card render. @source */
const CARD_SEED = 0x12345678;

/**
 * Builds one seeded generator function.
 * @returns A zero-argument function returning the next number in [0, 1).
 * @source
 */
function seededGenerator(): () => number {
  let state = CARD_SEED;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/**
 * Replaces `Date` with one that always reports the same instant.
 *
 * `new Date()` and `Date.now()` return the fixed time, while `new Date(value)`
 * still honours its arguments so parsing and arithmetic keep working.
 *
 * @param fixedMs - The instant to freeze at, in milliseconds.
 * @returns A function that restores the real `Date`.
 * @source
 */
function freezeClock(fixedMs: number): () => void {
  const RealDate = Date;
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(
        target,
        args.length ? args : [fixedMs],
        newTarget,
      );
    },
    apply() {
      return new RealDate(fixedMs).toString();
    },
    get(target, property, receiver) {
      return property === "now"
        ? () => fixedMs
        : Reflect.get(target, property, receiver);
    },
  });
  return () => {
    globalThis.Date = RealDate;
  };
}

/**
 * Runs `body` with a frozen clock, no network, and seeded randomness.
 *
 * Everything is restored in a `finally`, so a render that throws does not
 * leave the process with a fake clock or a broken `fetch`.
 *
 * @param fixedMs - The instant to freeze at.
 * @param body - The render work to run.
 * @returns Whatever `body` returns.
 * @source
 */
export async function withControlledRender<T>(
  fixedMs: number,
  body: (guard: RenderGuard) => Promise<T>,
): Promise<T> {
  const restoreClock = freezeClock(fixedMs);
  const originalRandom = Math.random;
  Math.random = seededGenerator();

  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  const refuse = (): never => {
    networkAttempts += 1;
    throw new Error("Network access is disabled during visual capture");
  };
  globalThis.fetch = new Proxy(originalFetch, {
    apply: refuse,
    get(target, property, receiver) {
      return property === "preconnect"
        ? refuse
        : Reflect.get(target, property, receiver);
    },
  });

  try {
    return await body({
      networkAttempts: () => networkAttempts,
      reseed: () => {
        Math.random = seededGenerator();
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    Math.random = originalRandom;
    restoreClock();
  }
}

/**
 * Hashes an SVG the way the manifest records it.
 * @param svg - The SVG source.
 * @returns A lowercase hex SHA-256 digest.
 * @source
 */
export function hashSvg(svg: string): string {
  return createHash("sha256").update(svg).digest("hex");
}
