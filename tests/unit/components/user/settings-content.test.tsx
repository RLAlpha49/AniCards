import "@/tests/unit/__setup__";

import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type TabsTriggerProps = ComponentProps<"button"> & {
  value: string;
};

type TabsContentProps = ComponentProps<"div"> & {
  value: string;
};

mock.module("framer-motion", () => {
  const MotionDiv = ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  );

  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: MotionDiv,
    },
  };
});

mock.module("@/components/stat-card-generator/ColorPickerGroup", () => ({
  ColorPickerGroup: () => <div data-kind="color-picker-group" />,
}));

mock.module("@/components/stat-card-generator/ColorPresetSelector", () => ({
  ColorPresetSelector: () => <div data-kind="color-preset-selector" />,
}));

mock.module("@/components/user/ColorPreviewCard", () => ({
  ColorPreviewCard: () => <div data-kind="color-preview-card" />,
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
  TabsContent: ({ children, value, ...props }: TabsContentProps) =>
    value === "colors" ? <div {...props}>{children}</div> : null,
}));

afterEach(() => {
  mock.restore();
});

describe("SettingsContent", () => {
  it("wires collapsible section toggles to stable controlled panels", async () => {
    const { SettingsContent } =
      await import("@/components/user/SettingsContent");
    const markup = renderToStaticMarkup(
      <SettingsContent
        idPrefix="settings-test"
        mode="global"
        colors={["#111111", "#222222", "#333333", "#444444"]}
        colorPreset="default"
        onColorChange={() => {}}
        onPresetChange={() => {}}
        borderEnabled={false}
        onBorderEnabledChange={() => {}}
        borderColor="#e4e2e2"
        onBorderColorChange={() => {}}
        borderRadius={0}
        onBorderRadiusChange={() => {}}
        advancedSettings={{}}
        onAdvancedSettingChange={() => {}}
        onReset={() => {}}
      />,
    );

    const expandedStates = [
      ...markup.matchAll(/aria-expanded="(true|false)"/g),
    ].map(([, value]) => value);
    expect(expandedStates).toHaveLength(2);
    expect(expandedStates).toContain("true");
    expect(expandedStates).toContain("false");

    const controlledIds = [...markup.matchAll(/aria-controls="([^"]+)"/g)].map(
      ([, value]) => value,
    );
    expect(controlledIds).toHaveLength(2);

    for (const id of controlledIds) {
      expect(markup).toContain(`id="${id}"`);
    }

    const collapsedPanelMatch =
      /aria-expanded="false" aria-controls="([^"]+)"/.exec(markup);
    const collapsedPanelId = collapsedPanelMatch?.[1] ?? null;
    expect(collapsedPanelId).not.toBeNull();
    expect(markup).toContain(`id="${collapsedPanelId}"`);
  });
});
