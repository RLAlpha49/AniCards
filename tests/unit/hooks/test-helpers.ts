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

type ResizeObserverConstructor = abstract new (...args: unknown[]) => unknown;

export type InstallHappyDomOptions = {
  additionalGlobals?: Record<string, unknown>;
  includeResizeObserver?: boolean | ResizeObserverConstructor;
  url?: string;
};

type HappyDomOptionsInput = InstallHappyDomOptions | string | undefined;

type NormalizedInstallHappyDomOptions = {
  additionalGlobals: Record<string, unknown>;
  includeResizeObserver: boolean | ResizeObserverConstructor;
  url: string;
};

const DEFAULT_HAPPY_DOM_URL = "https://anicards.test/";
const DEFAULT_HAPPY_DOM_OPTIONS: NormalizedInstallHappyDomOptions = {
  additionalGlobals: {},
  includeResizeObserver: false,
  url: DEFAULT_HAPPY_DOM_URL,
};

let domWindow: GlobalWindow | null = null;
let currentHappyDomOptions: NormalizedInstallHappyDomOptions = {
  ...DEFAULT_HAPPY_DOM_OPTIONS,
};
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();
const animationFrameHandles = new Set<ReturnType<typeof setTimeout>>();

const requestAnimationFrameStub = ((callback: FrameRequestCallback) => {
  const handle = setTimeout(() => {
    animationFrameHandles.delete(handle);
    callback(Date.now());
  }, 0);

  animationFrameHandles.add(handle);
  return handle as unknown as number;
}) as typeof requestAnimationFrame;

const cancelAnimationFrameStub = ((handle: number) => {
  const timerHandle = handle as unknown as ReturnType<typeof setTimeout>;

  animationFrameHandles.delete(timerHandle);
  clearTimeout(timerHandle);
}) as typeof cancelAnimationFrame;

function clearPendingAnimationFrames() {
  for (const handle of animationFrameHandles) {
    clearTimeout(handle);
  }

  animationFrameHandles.clear();
}

function normalizeInstallHappyDomOptions(
  options: HappyDomOptionsInput,
  baseOptions: NormalizedInstallHappyDomOptions,
): NormalizedInstallHappyDomOptions {
  if (typeof options === "string") {
    return {
      ...baseOptions,
      url: options,
    };
  }

  return {
    additionalGlobals: {
      ...baseOptions.additionalGlobals,
      ...options?.additionalGlobals,
    },
    includeResizeObserver:
      options?.includeResizeObserver ?? baseOptions.includeResizeObserver,
    url: options?.url ?? baseOptions.url,
  };
}

function createNoopResizeObserverConstructor() {
  return class ResizeObserverStub {
    disconnect() {
      return undefined;
    }

    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }
  };
}

function setGlobalValue(key: string, value: unknown) {
  if (!originalDescriptors.has(key)) {
    originalDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    );
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

function applyHappyDomGlobals(options: NormalizedInstallHappyDomOptions) {
  if (!domWindow) {
    return;
  }

  Object.assign(domWindow, {
    Error,
    SyntaxError,
    TypeError,
  });
  Object.defineProperty(domWindow, "requestAnimationFrame", {
    configurable: true,
    value: requestAnimationFrameStub,
    writable: true,
  });
  Object.defineProperty(domWindow, "cancelAnimationFrame", {
    configurable: true,
    value: cancelAnimationFrameStub,
    writable: true,
  });

  const resizeObserverValue =
    options.includeResizeObserver === true
      ? createNoopResizeObserverConstructor()
      : options.includeResizeObserver || undefined;

  const globalValues: Record<string, unknown> = {
    window: domWindow,
    document: domWindow.document,
    navigator: domWindow.navigator,
    location: domWindow.location,
    self: domWindow,
    Node: domWindow.Node,
    Element: domWindow.Element,
    Event: domWindow.Event,
    EventTarget: domWindow.EventTarget,
    CustomEvent: domWindow.CustomEvent,
    MouseEvent: domWindow.MouseEvent,
    KeyboardEvent: domWindow.KeyboardEvent,
    FocusEvent: domWindow.FocusEvent,
    InputEvent: domWindow.InputEvent,
    MutationObserver: domWindow.MutationObserver,
    HTMLElement: domWindow.HTMLElement,
    HTMLAnchorElement: domWindow.HTMLAnchorElement,
    HTMLButtonElement: domWindow.HTMLButtonElement,
    HTMLFormElement: domWindow.HTMLFormElement,
    HTMLInputElement: domWindow.HTMLInputElement,
    DocumentFragment: domWindow.DocumentFragment,
    SVGElement: domWindow.SVGElement,
    Text: domWindow.Text,
    ResizeObserver: resizeObserverValue,
    getComputedStyle: domWindow.getComputedStyle.bind(domWindow),
    requestAnimationFrame: requestAnimationFrameStub,
    cancelAnimationFrame: cancelAnimationFrameStub,
    IS_REACT_ACT_ENVIRONMENT: true,
    ...options.additionalGlobals,
  };

  for (const [key, value] of Object.entries(globalValues)) {
    setGlobalValue(key, value);
  }
}

export function installHappyDom(options?: HappyDomOptionsInput) {
  currentHappyDomOptions = normalizeInstallHappyDomOptions(
    options,
    DEFAULT_HAPPY_DOM_OPTIONS,
  );

  if (!domWindow) {
    domWindow = new GlobalWindow();
  }

  domWindow.location.href = currentHappyDomOptions.url;
  applyHappyDomGlobals(currentHappyDomOptions);

  return domWindow;
}

export function resetHappyDom(options?: HappyDomOptionsInput) {
  if (!domWindow) return;

  currentHappyDomOptions = normalizeInstallHappyDomOptions(
    options,
    currentHappyDomOptions,
  );

  clearPendingAnimationFrames();
  domWindow.document.head.innerHTML = "";
  domWindow.document.body.innerHTML = "";
  domWindow.localStorage.clear();
  domWindow.sessionStorage.clear();
  domWindow.location.href = currentHappyDomOptions.url;
  applyHappyDomGlobals(currentHappyDomOptions);
}

export function restoreHappyDom() {
  clearPendingAnimationFrames();
  currentHappyDomOptions = {
    ...DEFAULT_HAPPY_DOM_OPTIONS,
  };

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
