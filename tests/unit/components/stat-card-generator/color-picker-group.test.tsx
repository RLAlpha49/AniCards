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
import React, { type ComponentProps, type ReactNode } from "react";

import type { ColorValue } from "@/lib/types/card";

let restoreDomGlobals: (() => void) | null = null;
let ColorPickerGroup: typeof import("@/components/stat-card-generator/ColorPickerGroup").ColorPickerGroup;

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
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
  const MotionDiv = ({
    animate,
    children,
    exit,
    initial,
    transition,
    ...props
  }: MotionDivProps) => {
    void animate;
    void exit;
    void initial;
    void transition;

    return <div {...props}>{children}</div>;
  };

  return {
    motion: {
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

mock.module("@/components/ui/Input", () => ({
  Input: (props: ComponentProps<"input">) => <input {...props} />,
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

function isGradientChange(
  value: unknown,
): value is Exclude<ColorValue, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "stops" in value &&
    Array.isArray((value as { stops?: unknown }).stops)
  );
}

function installDomGlobals() {
  const window = new Window({
    url: "http://localhost/colors",
  });
  Object.assign(window, {
    Error,
    SyntaxError,
    TypeError,
  });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();

  const assignGlobal = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  };

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
  assignGlobal("HTMLInputElement", window.HTMLInputElement);
  assignGlobal("InputEvent", window.InputEvent);
  assignGlobal("KeyboardEvent", window.KeyboardEvent);
  assignGlobal("MouseEvent", window.MouseEvent);
  assignGlobal("MutationObserver", window.MutationObserver);
  assignGlobal("Node", window.Node);
  assignGlobal("SVGElement", window.SVGElement);
  assignGlobal("Text", window.Text);
  assignGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  assignGlobal("requestAnimationFrame", ((callback: FrameRequestCallback) =>
    setTimeout(
      () => callback(Date.now()),
      0,
    )) as unknown as typeof requestAnimationFrame);
  assignGlobal("cancelAnimationFrame", ((
    handle: ReturnType<typeof setTimeout>,
  ) => clearTimeout(handle)) as unknown as typeof cancelAnimationFrame);
  assignGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  return () => {
    cleanup();

    for (const [key, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }

    window.document.body.innerHTML = "";

    if (typeof window.close === "function") {
      window.close();
    }
  };
}

function renderColorPicker(initialValue: ColorValue, disableGradient = false) {
  const onChange = mock((nextValue: ColorValue) => nextValue);

  if (!ColorPickerGroup) {
    throw new TypeError(
      "Expected ColorPickerGroup to be loaded before rendering.",
    );
  }

  function Harness() {
    const [value, setValue] = React.useState<ColorValue>(initialValue);

    return (
      <ColorPickerGroup
        pickers={[
          {
            disableGradient,
            id: "accent",
            label: "Accent",
            onChange: (nextValue) => {
              onChange(nextValue);
              setValue(nextValue);
            },
            value,
          },
        ]}
      />
    );
  }

  return {
    onChange,
    ...render(<Harness />),
  };
}

describe("ColorPickerGroup", () => {
  beforeAll(async () => {
    ({ ColorPickerGroup } =
      await import("@/components/stat-card-generator/ColorPickerGroup"));
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

  it("toggles between solid and gradient modes while preserving the chosen base color", async () => {
    const view = renderColorPicker("#123456");
    const { onChange } = view;

    fireEvent.click(
      view.getByRole("button", {
        name: /switch accent to gradient mode/i,
      }),
    );

    await waitFor(() => {
      expect(onChange.mock.calls).toHaveLength(1);
    });

    const firstChange = onChange.mock.calls[0]?.[0];
    if (!isGradientChange(firstChange)) {
      throw new Error("Expected the first change to be a gradient definition.");
    }

    expect(firstChange.type).toBe("linear");
    expect(firstChange.angle).toBe(90);
    expect(firstChange.stops).toHaveLength(2);
    expect(firstChange.stops[0]?.color).toBe("#123456");
    expect(firstChange.stops[0]?.offset).toBe(0);
    expect(firstChange.stops[1]?.offset).toBe(100);
    expect(
      view.getByRole("button", {
        name: /switch accent to solid mode/i,
      }),
    ).toBeTruthy();
    expect(
      view.getByRole("button", {
        name: /add gradient color stop 3 of 5/i,
      }),
    ).toBeTruthy();

    fireEvent.click(
      view.getByRole("button", {
        name: /switch accent to solid mode/i,
      }),
    );

    await waitFor(() => {
      expect(onChange.mock.calls).toHaveLength(2);
    });

    expect(onChange.mock.calls[1]?.[0]).toBe("#123456");
  });

  it("keeps alpha-backed solid values in sync across the swatch, hex field, and opacity slider", () => {
    const view = renderColorPicker("#ABCDEF80");

    const colorInput = view.getByLabelText(
      "Accent color picker",
    ) as HTMLInputElement;
    const hexInput = view.getByLabelText(
      "Accent color hex code input",
    ) as HTMLInputElement;
    const opacityInput = view.getByLabelText(
      "Accent opacity slider",
    ) as HTMLInputElement;

    expect(colorInput.value).toBe("#abcdef");
    expect(hexInput.value).toBe("ABCDEF80");
    expect(opacityInput.value).toBe("50");
    expect(view.getByText("50%")).toBeTruthy();
  });

  it("shows invalid-value feedback while preserving the raw hex candidate and fallback swatch", () => {
    const view = renderColorPicker("oops");

    expect(view.getByText("Invalid color value")).toBeTruthy();

    const hexInput = view.getByLabelText(
      "Accent color hex code input",
    ) as HTMLInputElement;
    const colorInput = view.getByLabelText(
      "Accent color picker",
    ) as HTMLInputElement;

    expect(hexInput.value).toBe("oops");
    expect(colorInput.value).toBe("#000000");
  });

  it("updates gradient controls and stop collections for gradient pickers", async () => {
    const initialGradient: ColorValue = {
      angle: 90,
      stops: [
        {
          color: "#111111",
          offset: 0,
        },
        {
          color: "#333333",
          offset: 100,
        },
      ],
      type: "linear",
    };
    const view = renderColorPicker(initialGradient);
    const { onChange } = view;

    fireEvent.click(
      view.getByRole("button", {
        name: /add gradient color stop 3 of 5/i,
      }),
    );

    await waitFor(() => {
      const latestChange = onChange.mock.calls.at(-1)?.[0];
      if (!isGradientChange(latestChange)) {
        throw new Error("Expected a gradient change after adding a stop.");
      }

      expect(latestChange.stops).toHaveLength(3);
    });

    expect(
      view.getByRole("button", {
        name: /remove gradient stop 3/i,
      }),
    ).toBeTruthy();

    fireEvent.click(
      view.getByRole("button", {
        name: /radial gradient type/i,
      }),
    );

    await waitFor(() => {
      const latestChange = onChange.mock.calls.at(-1)?.[0];
      if (!isGradientChange(latestChange)) {
        throw new Error("Expected a gradient change after switching type.");
      }

      expect(latestChange.type).toBe("radial");
    });

    const radialInputs = view.getAllByRole("spinbutton") as HTMLInputElement[];

    expect(view.getByText("Center Position")).toBeTruthy();
    expect(radialInputs).toHaveLength(3);
    expect(radialInputs.map((input) => input.value)).toEqual([
      "50",
      "50",
      "50",
    ]);

    fireEvent.click(
      view.getByRole("button", {
        name: /remove gradient stop 3/i,
      }),
    );

    await waitFor(() => {
      const latestChange = onChange.mock.calls.at(-1)?.[0];
      if (!isGradientChange(latestChange)) {
        throw new Error("Expected a gradient change after removing a stop.");
      }

      expect(latestChange.stops).toHaveLength(2);
    });
  });
});
