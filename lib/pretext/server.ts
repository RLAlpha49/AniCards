import type { createCanvas } from "@napi-rs/canvas";

import { logPrivacySafe } from "@/lib/api/logging";
import {
  isPretextRuntimeReady,
  registerPretextRuntime,
  resetPretextRuntime,
  resetPretextRuntimeForTests,
} from "@/lib/pretext/runtime";

interface Canvas2DProvider {
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
}

type CreateCanvasFn = typeof createCanvas;
type MutableGlobalScope = typeof globalThis & {
  OffscreenCanvas?: typeof OffscreenCanvas;
};

let initializationPromise: Promise<boolean> | null = null;
let installedOffscreenCanvasShim = false;
let previousOffscreenCanvas: typeof OffscreenCanvas | null | undefined;

function restoreOffscreenCanvasShim(): void {
  if (!installedOffscreenCanvasShim) {
    return;
  }

  const globalScope = globalThis as MutableGlobalScope;

  if (typeof previousOffscreenCanvas === "function") {
    globalScope.OffscreenCanvas = previousOffscreenCanvas;
  } else {
    Reflect.deleteProperty(globalScope, "OffscreenCanvas");
  }

  installedOffscreenCanvasShim = false;
  previousOffscreenCanvas = undefined;
}

function installOffscreenCanvasShim(createCanvasImpl: CreateCanvasFn): void {
  const globalScope = globalThis as MutableGlobalScope;

  if (typeof globalScope.OffscreenCanvas === "function") {
    return;
  }

  previousOffscreenCanvas = globalScope.OffscreenCanvas ?? null;

  // Minimal shim for server-side pretext rendering: it only supports
  // `getContext("2d")`. Other OffscreenCanvas APIs are intentionally absent and
  // will fail if callers try to use them.
  class NodeOffscreenCanvas {
    readonly height: number;
    readonly width: number;

    private readonly canvas: Canvas2DProvider;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.canvas = createCanvasImpl(
        width,
        height,
      ) as unknown as Canvas2DProvider;
    }

    getContext(contextId: "2d"): CanvasRenderingContext2D | null {
      return this.canvas.getContext(contextId);
    }
  }

  globalScope.OffscreenCanvas =
    NodeOffscreenCanvas as unknown as typeof OffscreenCanvas;
  installedOffscreenCanvasShim = true;
}

/**
 * Initializes the server-side Pretext runtime and reports whether it is ready.
 *
 * This function is idempotent: it exits early when the runtime is already
 * ready, caches the in-flight initialization promise, and returns `false`
 * when called in a browser environment. On the server it installs the
 * OffscreenCanvas shim, registers the Pretext runtime, and resolves to `true`
 * when setup succeeds. If initialization fails, the error is logged with
 * `logPrivacySafe`, the runtime is reset, and the function resolves to `false`
 * instead of throwing. That failed result stays cached until process restart
 * or `resetServerPretextForTests()` so request paths do not keep retrying the
 * same broken native setup on every render.
 */
export async function initializeServerPretext(): Promise<boolean> {
  if (typeof document !== "undefined") {
    return false;
  }

  if (isPretextRuntimeReady()) {
    return true;
  }

  initializationPromise ??= (async () => {
    try {
      const canvasModule = await import("@napi-rs/canvas");
      installOffscreenCanvasShim(canvasModule.createCanvas);

      const pretextModule = await import("@chenglou/pretext");
      registerPretextRuntime({
        layout: pretextModule.layout,
        prepareWithSegments: pretextModule.prepareWithSegments,
        walkLineRanges: pretextModule.walkLineRanges,
      });

      return true;
    } catch (error) {
      logPrivacySafe(
        "error",
        "Pretext Server",
        "initializeServerPretext failed",
        {
          component: "initializeServerPretext",
          event: "init_failed",
          error,
        },
      );
      try {
        resetPretextRuntime();
        restoreOffscreenCanvasShim();
      } catch (resetError) {
        logPrivacySafe(
          "error",
          "Pretext Server",
          "resetPretextRuntime failed after initialization failure",
          {
            component: "initializeServerPretext",
            event: "reset_failed",
            error: resetError,
          },
        );
      }
      return false;
    }
  })();
  return initializationPromise;
}

/**
 * Test-only helper that clears module-level Pretext initialization state
 * between tests.
 *
 * This should not be used in production code; it exists so test teardown can
 * reset both the lazy initialization promise and the runtime caches.
 */
export function resetServerPretextForTests(): void {
  initializationPromise = null;
  resetPretextRuntimeForTests();
  restoreOffscreenCanvasShim();
}
