import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import type { ComponentProps, ReactNode } from "react";

import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("http://localhost/settings");

type ButtonProps = ComponentProps<"button"> & {
  size?: string;
  variant?: string;
};

type SwitchProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<ComponentProps<"button">, "onChange">;

type TabsTriggerProps = ComponentProps<"button"> & {
  value: string;
};

type TabsContentProps = ComponentProps<"div"> & {
  value: string;
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

function registerModuleMocks() {
  mock.module("@/components/ui/Motion", () => {
    const MotionButton = ({ children, ...props }: ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    );

    const MotionDiv = ({ children, ...props }: ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    );

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

  mock.module("@/components/user/ColorPreviewCard", () => ({
    ColorPreviewCard: () => <div data-kind="color-preview-card" />,
  }));

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

  mock.module("@/components/ui/Input", () => ({
    Input: (props: ComponentProps<"input">) => <input {...props} />,
  }));

  mock.module("@/components/ui/Label", () => ({
    Label: ({ children, ...props }: ComponentProps<"label">) => (
      <label {...props}>{children}</label>
    ),
  }));

  mock.module("@/components/ui/Switch", () => ({
    Switch: ({ checked = false, onCheckedChange, ...props }: SwitchProps) => (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      />
    ),
  }));

  mock.module("@/components/ui/Tabs", () => ({
    Tabs: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    TabsList: ({ children, ...props }: ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
    TabsTrigger: ({ children, value, ...props }: TabsTriggerProps) => (
      <button data-value={value} type="button" {...props}>
        {children}
      </button>
    ),
    TabsContent: ({ children, value, ...props }: TabsContentProps) => (
      <div data-value={value} {...props}>
        {children}
      </div>
    ),
  }));
}

beforeEach(() => {
  resetHappyDom("http://localhost/settings");
  registerModuleMocks();
});

afterEach(() => {
  cleanup();
  mock.restore();
});

afterAll(() => {
  restoreHappyDom();
  mock.restore();
});

function installCanvasColorParserStub() {
  const originalCreateElement = document.createElement.bind(document);

  document.createElement = ((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    if (tagName.toLowerCase() === "canvas") {
      let fillStyle = "";
      const context = {
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(value: string) {
          const normalizedNamedColor =
            value.trim().toLowerCase() === "red" ? "#ff0000" : undefined;

          if (!normalizedNamedColor) {
            throw new TypeError(`Unsupported canvas color: ${value}`);
          }

          fillStyle = normalizedNamedColor;
        },
      };

      return {
        getContext: () => context,
      } as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName, options);
  }) as typeof document.createElement;

  return () => {
    document.createElement = originalCreateElement;
  };
}

async function renderSettingsContent(overrides: Record<string, unknown> = {}) {
  const { SettingsContent } = await import("@/components/user/SettingsContent");

  const baseProps: ComponentProps<typeof SettingsContent> = {
    idPrefix: "settings-test",
    mode: "global",
    colors: ["#111111", "#222222", "#333333", "#444444"],
    colorPreset: "default",
    onColorChange: mock(() => undefined),
    onPresetChange: mock(() => undefined),
    borderEnabled: false,
    onBorderEnabledChange: mock(() => undefined),
    borderColor: "#e4e2e2",
    onBorderColorChange: mock(() => undefined),
    borderRadius: 0,
    onBorderRadiusChange: mock(() => undefined),
    advancedSettings: {
      useStatusColors: false,
      showPiePercentages: false,
      showFavorites: false,
      gridCols: 3,
      gridRows: 3,
    },
    onAdvancedSettingChange: mock(() => undefined),
    onReset: mock(() => undefined),
    onValidityChange: mock(() => undefined),
  };

  const props = {
    ...baseProps,
    ...overrides,
  } as ComponentProps<typeof SettingsContent>;

  return {
    ...render(<SettingsContent {...props} />),
    props,
  };
}

describe("SettingsContent", () => {
  it("wires collapsible section toggles to stable controlled panels", async () => {
    const view = await renderSettingsContent();

    const colorPresetToggle = view.getByRole("button", {
      name: /color preset/i,
    });
    const customColorsToggle = view.getByRole("button", {
      name: /custom colors/i,
    });

    expect(colorPresetToggle.getAttribute("aria-expanded")).toBe("true");
    expect(customColorsToggle.getAttribute("aria-expanded")).toBe("false");

    const controlledPanelId = customColorsToggle.getAttribute("aria-controls");
    expect(controlledPanelId).toBeTruthy();
    expect(
      controlledPanelId
        ? view.container.querySelector(`#${controlledPanelId}`)
        : null,
    ).toBeTruthy();

    fireEvent.click(customColorsToggle);
    expect(customColorsToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("reports invalid border settings through the validity callback", async () => {
    const onValidityChange = mock((isValid: boolean) => isValid);
    const view = await renderSettingsContent({
      borderEnabled: true,
      borderColor: "",
      onValidityChange,
    });

    await waitFor(() => {
      expect(onValidityChange.mock.calls.at(-1)).toEqual([false]);
    });

    view.getByText(/invalid color/i);
  });

  it("maps named border colors into the color picker and preserves the text value", async () => {
    const restoreCanvas = installCanvasColorParserStub();

    try {
      const view = await renderSettingsContent({
        borderEnabled: true,
        borderColor: "red",
      });

      const borderColorInput = view.getByLabelText(
        "Border Color",
      ) as HTMLInputElement;
      const borderColorPicker = view.getByLabelText(
        "Border color picker",
      ) as HTMLInputElement;

      expect(borderColorInput.value).toBe("red");
      expect(borderColorPicker.value).toBe("#ff0000");
    } finally {
      restoreCanvas();
    }
  });

  it("applies quick border presets and the reset action in global mode", async () => {
    const onBorderEnabledChange = mock((enabled: boolean) => enabled);
    const onBorderRadiusChange = mock((radius: number) => radius);
    const onReset = mock(() => undefined);
    const view = await renderSettingsContent({
      borderEnabled: false,
      borderRadius: 8,
      onBorderEnabledChange,
      onBorderRadiusChange,
      onReset,
    });

    fireEvent.click(view.getByRole("button", { name: /^square$/i }));
    fireEvent.click(view.getByRole("button", { name: /^rounded$/i }));
    fireEvent.click(view.getByRole("button", { name: /reset to defaults/i }));

    expect(onBorderEnabledChange.mock.calls).toContainEqual([true]);
    expect(onBorderRadiusChange.mock.calls).toContainEqual([0]);
    expect(onBorderRadiusChange.mock.calls).toContainEqual([16]);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("toggles advanced settings and exposes the documented grid bounds", async () => {
    const onAdvancedSettingChange = mock((key: string, value: unknown) => ({
      key,
      value,
    }));
    const onValidityChange = mock((isValid: boolean) => isValid);
    const view = await renderSettingsContent({
      onAdvancedSettingChange,
      onValidityChange,
    });

    fireEvent.click(view.getByRole("switch", { name: "Status colors" }));
    fireEvent.click(view.getByRole("switch", { name: "Show percentages" }));
    fireEvent.click(view.getByRole("switch", { name: "Show favorites" }));

    expect(onAdvancedSettingChange.mock.calls).toContainEqual([
      "useStatusColors",
      true,
    ]);
    expect(onAdvancedSettingChange.mock.calls).toContainEqual([
      "showPiePercentages",
      true,
    ]);
    expect(onAdvancedSettingChange.mock.calls).toContainEqual([
      "showFavorites",
      true,
    ]);

    const gridColsInput = view.container.querySelector(
      "#settings-test-gridCols",
    ) as HTMLInputElement;
    const gridRowsInput = view.container.querySelector(
      "#settings-test-gridRows",
    ) as HTMLInputElement;

    await waitFor(() => {
      expect(onValidityChange.mock.calls.at(-1)).toEqual([true]);
    });

    expect(gridColsInput.getAttribute("min")).toBe("1");
    expect(gridColsInput.getAttribute("max")).toBe("5");
    expect(gridRowsInput.getAttribute("min")).toBe("1");
    expect(gridRowsInput.getAttribute("max")).toBe("5");
  });

  it("uses inherited card settings and quick preset buttons in card mode", async () => {
    const onPresetChange = mock((preset: string) => preset);
    const view = await renderSettingsContent({
      mode: "card",
      colorPreset: "anilistDark",
      onPresetChange,
      advancedSettings: {},
      inheritedAdvancedSettings: {
        gridCols: 4,
        gridRows: 2,
      },
      advancedVisibility: {
        showGridSize: true,
      },
      resetLabel: "Reset card settings",
    });

    const gridColsInput = view.container.querySelector(
      "#settings-test-gridCols",
    ) as HTMLInputElement;
    const gridRowsInput = view.container.querySelector(
      "#settings-test-gridRows",
    ) as HTMLInputElement;

    expect(gridColsInput.value).toBe("4");
    expect(gridRowsInput.value).toBe("2");

    fireEvent.click(view.getByRole("button", { name: /^default$/i }));
    fireEvent.click(view.getByRole("button", { name: /^anilist light$/i }));

    expect(onPresetChange.mock.calls).toEqual([["default"], ["anilistLight"]]);
    view.getByRole("button", { name: /reset card settings/i });
  });
});
