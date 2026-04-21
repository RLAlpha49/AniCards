import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { createElement, type ReactNode } from "react";

import {
  COARSE_POINTER_MEDIA_QUERY,
  REDUCED_DATA_MEDIA_QUERY,
} from "@/lib/animations";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("http://localhost/motion-preferences");

let runtimeReducedMotion: boolean | null = false;
let useMotionPreferences: typeof import("@/hooks/useMotionPreferences").useMotionPreferences;
let restoreMatchMedia: (() => void) | null = null;
let setMediaQueryMatch: ((query: string, matches: boolean) => void) | null =
  null;

type MotionStubProps = {
  animate?: unknown;
  children?: ReactNode;
  exit?: unknown;
  initial?: unknown;
  layout?: unknown;
  layoutId?: unknown;
  transition?: unknown;
  variants?: unknown;
  viewport?: unknown;
  whileHover?: unknown;
  whileInView?: unknown;
  whileTap?: unknown;
} & Record<string, unknown>;

function omitMotionProps(props: MotionStubProps) {
  const next = { ...props };

  for (const key of [
    "animate",
    "exit",
    "initial",
    "layout",
    "layoutId",
    "transition",
    "variants",
    "viewport",
    "whileHover",
    "whileInView",
    "whileTap",
  ] as const) {
    Reflect.deleteProperty(next, key);
  }

  return next;
}

mock.module("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_target, key) => {
        const elementName = typeof key === "string" ? key : "div";

        return ({ children, ...props }: MotionStubProps) =>
          createElement(elementName, omitMotionProps(props), children);
      },
    },
  ),
  useInView: () => true,
  useReducedMotion: () => runtimeReducedMotion,
}));

function installMatchMediaController(
  initialMatches: Record<string, boolean> = {},
) {
  const domWindow = globalThis.window;
  const previousMatchMedia = domWindow.matchMedia;
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const queryStates = new Map<string, boolean>(Object.entries(initialMatches));
  const queryLists = new Map<string, MediaQueryList>();

  const ensureQueryList = (query: string) => {
    const existing = queryLists.get(query);
    if (existing) {
      return existing;
    }

    const queryListeners =
      listeners.get(query) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.set(query, queryListeners);

    let onChange: MediaQueryList["onchange"] = null;

    const queryList: MediaQueryList = {
      get matches() {
        return queryStates.get(query) ?? false;
      },
      media: query,
      get onchange() {
        return onChange;
      },
      set onchange(listener) {
        onChange = listener;
      },
      addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
      ) {
        if (type === "change" && listener) {
          queryListeners.add(listener);
        }
      },
      removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
      ) {
        if (type === "change" && listener) {
          queryListeners.delete(listener);
        }
      },
      addListener(listener) {
        queryListeners.add(listener as unknown as EventListener);
      },
      removeListener(listener) {
        queryListeners.delete(listener as unknown as EventListener);
      },
      dispatchEvent() {
        return true;
      },
    };

    queryLists.set(query, queryList);
    return queryList;
  };

  Object.defineProperty(domWindow, "matchMedia", {
    configurable: true,
    value: (query: string) => ensureQueryList(query),
    writable: true,
  });

  return {
    restore: () => {
      if (previousMatchMedia) {
        Object.defineProperty(domWindow, "matchMedia", {
          configurable: true,
          value: previousMatchMedia,
          writable: true,
        });
        return;
      }

      Reflect.deleteProperty(domWindow, "matchMedia");
    },
    setMatches: (query: string, matches: boolean) => {
      queryStates.set(query, matches);
      const queryList = ensureQueryList(query);
      const changeEvent = new globalThis.Event("change");

      for (const listener of listeners.get(query) ?? []) {
        if (typeof listener === "function") {
          listener(changeEvent);
        } else {
          listener.handleEvent(changeEvent);
        }
      }

      queryList.onchange?.call(queryList, changeEvent as never);
    },
  };
}

type MotionPreferencesSnapshot = ReturnType<typeof useMotionPreferences>;

function MotionPreferencesProbe(props: {
  onRender: (snapshot: MotionPreferencesSnapshot) => void;
}) {
  props.onRender(useMotionPreferences());
  return null;
}

beforeEach(async () => {
  resetHappyDom("http://localhost/motion-preferences");
  runtimeReducedMotion = false;

  const mediaController = installMatchMediaController();
  restoreMatchMedia = mediaController.restore;
  setMediaQueryMatch = mediaController.setMatches;

  ({ useMotionPreferences } = await import("@/hooks/useMotionPreferences"));
});

afterEach(() => {
  cleanup();
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  setMediaQueryMatch = null;
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("useMotionPreferences", () => {
  it("starts in the safe reduced/simplified state before hydration resolves", async () => {
    const renders: MotionPreferencesSnapshot[] = [];

    render(
      <MotionPreferencesProbe
        onRender={(snapshot) => renders.push(snapshot)}
      />,
    );

    expect(renders[0]).toMatchObject({
      prefersReducedMotion: true,
      prefersSimplifiedMotion: true,
    });

    await waitFor(() => {
      expect(renders.at(-1)).toMatchObject({
        prefersCoarsePointer: false,
        prefersReducedData: false,
        prefersReducedMotion: false,
        prefersSimplifiedMotion: false,
      });
    });
  });

  it("reacts to reduced-data and coarse-pointer media-query changes", async () => {
    const renders: MotionPreferencesSnapshot[] = [];

    render(
      <MotionPreferencesProbe
        onRender={(snapshot) => renders.push(snapshot)}
      />,
    );

    await waitFor(() => {
      expect(renders.at(-1)?.prefersSimplifiedMotion).toBe(false);
    });

    act(() => {
      setMediaQueryMatch?.(REDUCED_DATA_MEDIA_QUERY, true);
    });

    await waitFor(() => {
      expect(renders.at(-1)).toMatchObject({
        prefersReducedData: true,
        prefersSimplifiedMotion: true,
      });
    });

    act(() => {
      setMediaQueryMatch?.(REDUCED_DATA_MEDIA_QUERY, false);
      setMediaQueryMatch?.(COARSE_POINTER_MEDIA_QUERY, true);
    });

    await waitFor(() => {
      expect(renders.at(-1)).toMatchObject({
        prefersCoarsePointer: true,
        prefersReducedData: false,
        prefersSimplifiedMotion: true,
      });
    });
  });
});
