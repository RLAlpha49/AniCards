import { mock } from "bun:test";
import { GlobalWindow } from "happy-dom";

import { colorPresets } from "@/components/stat-card-generator/constants";
import type {
  CardEditorConfig,
  LocalEditsPatch,
} from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import type { SettingsSnapshot } from "@/lib/user-page-settings-io";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "location",
  "self",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLAnchorElement",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;

let domWindow: GlobalWindow | null = null;
const originalDescriptors = new Map<
  (typeof GLOBAL_KEYS)[number],
  PropertyDescriptor | undefined
>();

function setGlobalValue(key: (typeof GLOBAL_KEYS)[number], value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

export function installHappyDom(url = "https://anicards.test/") {
  if (!domWindow) {
    domWindow = new GlobalWindow();
    domWindow.location.href = url;

    for (const key of GLOBAL_KEYS) {
      if (!originalDescriptors.has(key)) {
        originalDescriptors.set(
          key,
          Object.getOwnPropertyDescriptor(globalThis, key),
        );
      }
    }

    setGlobalValue("window", domWindow);
    setGlobalValue("document", domWindow.document);
    setGlobalValue("navigator", domWindow.navigator);
    setGlobalValue("location", domWindow.location);
    setGlobalValue("self", domWindow);
    setGlobalValue("Node", domWindow.Node);
    setGlobalValue("Element", domWindow.Element);
    setGlobalValue("HTMLElement", domWindow.HTMLElement);
    setGlobalValue("HTMLAnchorElement", domWindow.HTMLAnchorElement);
    setGlobalValue("DocumentFragment", domWindow.DocumentFragment);
    setGlobalValue("Event", domWindow.Event);
    setGlobalValue("CustomEvent", domWindow.CustomEvent);
    setGlobalValue("MouseEvent", domWindow.MouseEvent);
    setGlobalValue("KeyboardEvent", domWindow.KeyboardEvent);
    setGlobalValue("MutationObserver", domWindow.MutationObserver);
    setGlobalValue(
      "getComputedStyle",
      domWindow.getComputedStyle.bind(domWindow),
    );
    setGlobalValue(
      "requestAnimationFrame",
      domWindow.requestAnimationFrame.bind(domWindow),
    );
    setGlobalValue(
      "cancelAnimationFrame",
      domWindow.cancelAnimationFrame.bind(domWindow),
    );
    setGlobalValue("IS_REACT_ACT_ENVIRONMENT", true);
  }

  return domWindow;
}

export function resetHappyDom() {
  if (!domWindow) return;

  domWindow.document.head.innerHTML = "";
  domWindow.document.body.innerHTML = "";
  domWindow.localStorage.clear();
  domWindow.sessionStorage.clear();
  domWindow.location.href = "https://anicards.test/";
}

export function restoreHappyDom() {
  if (domWindow) {
    void Promise.resolve()
      .then(() => domWindow?.happyDOM.abort())
      .catch(() => {});

    domWindow = null;
  }

  for (const [key, descriptor] of originalDescriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
      continue;
    }

    delete (globalThis as Record<string, unknown>)[key];
  }

  originalDescriptors.clear();
}

export async function flushMicrotasks(rounds = 6) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

export interface MockUserPageEditorState {
  userId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  serverUpdatedAt: string | null;
  globalColorPreset: string;
  globalColors: ColorValue[];
  baselineGlobalSnapshot: SettingsSnapshot | null;
  cardOrder: string[];
  localEditsPatch: LocalEditsPatch | null;
  setSaving: (saving: boolean) => void;
  setSaveError: (error: string | null) => void;
  markSaved: (opts?: {
    serverUpdatedAt?: string | null;
    appliedPatch?: LocalEditsPatch | null;
  }) => void;
  discardChanges: () => void;
}

function createDefaultState() {
  return {
    userId: "42",
    isDirty: false,
    isSaving: false,
    saveError: null,
    serverUpdatedAt: "2026-03-29T00:00:00.000Z",
    globalColorPreset: "default",
    globalColors: [...colorPresets.default.colors],
    baselineGlobalSnapshot: null,
    cardOrder: [],
    localEditsPatch: null,
  } satisfies Omit<
    MockUserPageEditorState,
    "setSaving" | "setSaveError" | "markSaved" | "discardChanges"
  >;
}

export function createMockUserPageEditorStore() {
  const listeners = new Set<
    (next: MockUserPageEditorState, prev: MockUserPageEditorState) => void
  >();

  let state!: MockUserPageEditorState;

  const setState = (
    next:
      | Partial<MockUserPageEditorState>
      | ((
          current: MockUserPageEditorState,
        ) => Partial<MockUserPageEditorState>),
  ) => {
    const prev = state;
    const partial = typeof next === "function" ? next(state) : next;
    state = {
      ...state,
      ...partial,
    };

    for (const listener of listeners) {
      listener(state, prev);
    }
  };

  const setSaving = mock((saving: boolean) => {
    setState({ isSaving: saving });
  });

  const setSaveError = mock((error: string | null) => {
    setState({
      isSaving: false,
      saveError: error,
    });
  });

  const markSaved = mock(
    (opts?: {
      serverUpdatedAt?: string | null;
      appliedPatch?: LocalEditsPatch | null;
    }) => {
      setState({
        isDirty: false,
        isSaving: false,
        saveError: null,
        serverUpdatedAt: opts?.serverUpdatedAt ?? state.serverUpdatedAt,
      });
    },
  );

  const discardChanges = mock(() => {
    setState({
      isDirty: false,
      saveError: null,
    });
  });

  const buildLocalEditsPatch = mock(
    (snapshot: MockUserPageEditorState): LocalEditsPatch | null =>
      snapshot.localEditsPatch,
  );

  const useUserPageEditor = (<T>(
    selector?: (snapshot: MockUserPageEditorState) => T,
  ) => {
    if (selector) {
      return selector(state);
    }

    return state;
  }) as (<T>(
    selector?: (snapshot: MockUserPageEditorState) => T,
  ) => T extends undefined ? MockUserPageEditorState : T) & {
    getState: () => MockUserPageEditorState;
    setState: typeof setState;
    subscribe: (
      listener: (
        next: MockUserPageEditorState,
        prev: MockUserPageEditorState,
      ) => void,
    ) => () => void;
  };

  useUserPageEditor.getState = () => state;
  useUserPageEditor.setState = setState;
  useUserPageEditor.subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const reset = (overrides: Partial<MockUserPageEditorState> = {}) => {
    setSaving.mockClear();
    setSaveError.mockClear();
    markSaved.mockClear();
    discardChanges.mockClear();
    buildLocalEditsPatch.mockClear();

    state = {
      ...createDefaultState(),
      setSaving,
      setSaveError,
      markSaved,
      discardChanges,
      ...overrides,
    };
  };

  reset();

  return {
    getState: () => state,
    setState,
    reset,
    mocks: {
      buildLocalEditsPatch,
      discardChanges,
      markSaved,
      setSaveError,
      setSaving,
    },
    module: {
      buildLocalEditsPatch,
      useUserPageEditor,
    },
  };
}

export function createCardConfig(
  cardId: string,
  overrides: Partial<CardEditorConfig> = {},
): CardEditorConfig {
  return {
    cardId,
    enabled: overrides.enabled ?? true,
    variant: overrides.variant ?? "default",
    colorOverride: {
      useCustomSettings: false,
      ...overrides.colorOverride,
    },
    advancedSettings: {
      ...overrides.advancedSettings,
    },
    borderColor: overrides.borderColor,
    borderRadius: overrides.borderRadius,
  };
}

export function createGlobalSnapshot(
  overrides: Partial<SettingsSnapshot> = {},
): SettingsSnapshot {
  return {
    colorPreset: overrides.colorPreset ?? "custom",
    colors:
      overrides.colors ??
      ([
        "#111111",
        "#222222",
        "#333333",
        "#444444",
      ] as SettingsSnapshot["colors"]),
    borderEnabled: overrides.borderEnabled ?? false,
    borderColor: overrides.borderColor ?? "#e4e2e2",
    borderRadius: overrides.borderRadius ?? 8,
    advancedSettings: {
      useStatusColors: true,
      showPiePercentages: true,
      showFavorites: true,
      gridCols: 3,
      gridRows: 3,
      ...overrides.advancedSettings,
    },
  };
}
