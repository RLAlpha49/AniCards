/**
 * Makes `server-only` a no-op outside the Next.js bundler.
 *
 * `lib/server/` marks every module with `import "server-only"` so the bundler
 * fails the build when a `"use client"` module reaches one. The marker package
 * throws on import when nothing has aliased it, and Next aliases it in its own
 * compiler. Bun does not, so `bun run db:seed` and the visual-audit scripts
 * would throw before doing any work.
 *
 * Loaded from `bunfig.toml` for `bun run`. `tests/unit/__setup__.ts` registers
 * the same stub for `bun test`, whose preload list replaces this one.
 * @source
 */

import { mock } from "bun:test";

mock.module("server-only", () => ({}));
