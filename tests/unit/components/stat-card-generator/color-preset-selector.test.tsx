import "@/tests/unit/__setup__";

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { Window } from "happy-dom";
import type { ComponentProps, ReactNode } from "react";

import type { ColorValue } from "@/lib/types/card";

let restoreDomGlobals: (() => void) | null = null;
let ColorPresetSelector: typeof import("@/components/stat-card-generator/ColorPresetSelector").ColorPresetSelector;

type MotionButtonProps = ComponentProps<"button"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
};

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
  variants?: unknown;
};

type ButtonProps = ComponentProps<"button"> & {
  size?: string;
  variant?: string;
};

type TooltipTriggerProps = {
  asChild?: boolean;
  children?: ReactNode;
};

mock.module("framer-motion", () => {
  const MotionButton = ({
    animate,
    children,
    exit,
    initial,
    transition,
    whileHover,
    whileTap,
    ...props
  }: MotionButtonProps) => {
    void animate;
    void exit;
    void initial;
    void transition;
    void whileHover;
    void whileTap;

    return <button {...props}>{children}</button>;
  };

  const MotionDiv = ({
    animate,
    children,
    exit,
    initial,
    transition,
    variants,
    ...props
  }: MotionDivProps) => {
    void animate;
    void exit;
    void initial;
    void transition;
    void variants;

    return <div {...props}>{children}</div>;
  };

  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      button: MotionButton,
      div: MotionDiv,
    },
  };
});

mock.module("@/components/ui/Button", () => ({
  Button: ({
    children,
    size,
    type = "button",
    variant,
    ...props
  }: ButtonProps) => {
    void size;
    void variant;

    return (
      <button type={type} {...props}>
        {children}
      </button>
    );
  },
}));

mock.module("@/components/ui/Label", () => ({
  Label: ({ children, ...props }: ComponentProps<"label">) => (
    <label {...props}>{children}</label>
  ),
}));

mock.module("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ asChild, children }: TooltipTriggerProps) => {
    void asChild;
    return <>{children}</>;
  },
}));

function installDomGlobals() {
  const window = new Window({
    url: "http://localhost/presets",
  });
  Object.assign(window, {
    Error,
    SyntaxError,
    TypeError,
  });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const animationFrameHandles = new Set<ReturnType<typeof setTimeout>>();

  const assignGlobal = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  };

  class ResizeObserverStub {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  assignGlobal("window", window);
  assignGlobal("document", window.document);
  assignGlobal("navigator", window.navigator);
  assignGlobal("CustomEvent", window.CustomEvent);
  assignGlobal("Element", window.Element);
  assignGlobal("Event", window.Event);
  assignGlobal("EventTarget", window.EventTarget);
  assignGlobal("FocusEvent", window.FocusEvent);
  assignGlobal("HTMLElement", window.HTMLElement);
  assignGlobal("HTMLButtonElement", window.HTMLButtonElement);
  assignGlobal("KeyboardEvent", window.KeyboardEvent);
  assignGlobal("MouseEvent", window.MouseEvent);
  assignGlobal("MutationObserver", window.MutationObserver);
  assignGlobal("Node", window.Node);
  assignGlobal("SVGElement", window.SVGElement);
  assignGlobal("Text", window.Text);
  assignGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  assignGlobal("requestAnimationFrame", ((callback: FrameRequestCallback) => {
    const handle = setTimeout(() => {
      animationFrameHandles.delete(handle);
      callback(Date.now());
    }, 0);

    animationFrameHandles.add(handle);
    return handle;
  }) as unknown as typeof requestAnimationFrame);
  assignGlobal("cancelAnimationFrame", ((
    handle: ReturnType<typeof setTimeout>,
  ) => {
    animationFrameHandles.delete(handle);
    clearTimeout(handle);
  }) as unknown as typeof cancelAnimationFrame);
  assignGlobal("ResizeObserver", ResizeObserverStub);
  assignGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  return () => {
    cleanup();

    for (const handle of animationFrameHandles) {
      clearTimeout(handle);
    }
    animationFrameHandles.clear();

    window.document.body.innerHTML = "";

    if (typeof window.close === "function") {
      window.close();
    }

    for (const [key, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  };
}

const gradientAccent: ColorValue = {
  angle: 45,
  stops: [
    {
      color: "#112233",
      offset: 0,
    },
    {
      color: "#445566",
      offset: 100,
    },
  ],
  type: "linear",
};

const testPresets: Record<string, { colors: ColorValue[]; mode: string }> = {
  default: {
    colors: ["#111111", "#222222", "#333333", "#444444"],
    mode: "dark",
  },
  anilistLight: {
    colors: ["#f8fafc", "#e2e8f0", "#475569", "#f8fafc"],
    mode: "light",
  },
  anilistDarkGradient: {
    colors: [gradientAccent, "#0f172a", "#e2e8f0", gradientAccent],
    mode: "dark",
  },
  auroraGradient: {
    colors: [gradientAccent, "#fef3c7", "#312e81", gradientAccent],
    mode: "light",
  },
  custom: {
    colors: ["", "", "", ""],
    mode: "custom",
  },
};

describe("ColorPresetSelector", () => {
  beforeAll(async () => {
    ({ ColorPresetSelector } =
      await import("@/components/stat-card-generator/ColorPresetSelector"));
  });

  beforeEach(() => {
    restoreDomGlobals = installDomGlobals();
  });

  afterEach(() => {
    restoreDomGlobals?.();
    restoreDomGlobals = null;
  });

  afterAll(() => {
    mock.restore();
  });

  it("keeps the selected later preset and custom preset visible in the collapsed grid", () => {
    const view = render(
      <ColorPresetSelector
        selectedPreset="anilistDarkGradient"
        presets={testPresets}
        onPresetChange={() => {}}
      />,
    );

    expect(
      view.getByRole("button", {
        name: "Default preset, dark theme, solid colors",
      }),
    ).toBeTruthy();
    expect(
      view.getByRole("button", {
        name: "AniList Dark Gradient preset, dark theme, gradient colors",
      }),
    ).toBeTruthy();
    expect(
      view.getByRole("button", {
        name: "Custom preset, uses your edited colors",
      }),
    ).toBeTruthy();
    expect(
      view.queryByRole("button", {
        name: "AniList Light preset, light theme, solid colors",
      }),
    ).toBeNull();

    const showAllButton = view.getByRole("button", {
      name: /show all 5 presets/i,
    });
    expect(showAllButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("filters presets by color type and theme while keeping the custom option available", async () => {
    const view = render(
      <ColorPresetSelector
        selectedPreset="auroraGradient"
        presets={testPresets}
        onPresetChange={() => {}}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /^Gradient \(2\)$/ }));

    await waitFor(() => {
      expect(view.getByText("3 of 5")).toBeTruthy();
    });

    expect(
      view.getByRole("button", {
        name: "Aurora Gradient preset, light theme, gradient colors",
      }),
    ).toBeTruthy();
    expect(
      view.queryByRole("button", {
        name: "Default preset, dark theme, solid colors",
      }),
    ).toBeNull();

    fireEvent.click(view.getByRole("button", { name: /^Light \(2\)$/ }));

    await waitFor(() => {
      expect(view.getByText("2 of 5")).toBeTruthy();
    });

    expect(
      view.getByRole("button", {
        name: "Aurora Gradient preset, light theme, gradient colors",
      }),
    ).toBeTruthy();
    expect(
      view.getByRole("button", {
        name: "Custom preset, uses your edited colors",
      }),
    ).toBeTruthy();
    expect(
      view.queryByRole("button", {
        name: "AniList Dark Gradient preset, dark theme, gradient colors",
      }),
    ).toBeNull();
  });

  it("reveals hidden presets on expand and tracks the selected preset", async () => {
    const onPresetChange = mock((preset: string) => preset);

    const view = render(
      <ColorPresetSelector
        selectedPreset="default"
        presets={testPresets}
        onPresetChange={onPresetChange}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /show all 5 presets/i }));

    const auroraButton = await view.findByRole("button", {
      name: "Aurora Gradient preset, light theme, gradient colors",
    });

    fireEvent.click(auroraButton);

    expect(view.getByRole("button", { name: /show less/i })).toBeTruthy();
    expect(onPresetChange.mock.calls).toEqual([["auroraGradient"]]);
  });
});
