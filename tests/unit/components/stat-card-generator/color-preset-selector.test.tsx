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
import type { ComponentProps, ReactNode } from "react";

import type { ColorValue } from "@/lib/types/card";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

let ColorPresetSelector: typeof import("@/components/stat-card-generator/ColorPresetSelector").ColorPresetSelector;

installHappyDom({
  includeResizeObserver: true,
  url: "http://localhost/presets",
});

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
  children?: ReactNode;
};

function omitStubProps<T extends object, K extends keyof T>(
  props: T,
  keys: readonly K[],
): Omit<T, K> {
  const next = { ...props };

  for (const key of keys) {
    Reflect.deleteProperty(next, key);
  }

  return next as Omit<T, K>;
}

mock.module("@/components/ui/Motion", () => {
  const MotionButton = ({ children, ...props }: MotionButtonProps) => {
    const buttonProps = omitStubProps(props, [
      "animate",
      "exit",
      "initial",
      "transition",
      "whileHover",
      "whileTap",
    ] as const);

    return <button {...buttonProps}>{children}</button>;
  };

  const MotionDiv = ({ children, ...props }: MotionDivProps) => {
    const divProps = omitStubProps(props, [
      "animate",
      "exit",
      "initial",
      "transition",
      "variants",
    ] as const);

    return <div {...divProps}>{children}</div>;
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
  Button: ({ children, type = "button", ...props }: ButtonProps) => {
    const buttonProps = omitStubProps(props, ["size", "variant"] as const);

    return (
      <button type={type} {...buttonProps}>
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
  TooltipTrigger: ({ children }: TooltipTriggerProps) => <>{children}</>,
}));

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
    resetHappyDom("http://localhost/presets");
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    restoreHappyDom();
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
