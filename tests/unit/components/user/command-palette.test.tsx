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
import type { ComponentProps, ReactNode } from "react";

import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("https://anicards.test/user/Alpha49");

type DialogProps = {
  children?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

type DialogContentProps = ComponentProps<"div"> & {
  hideCloseButton?: boolean;
};

type CommandRootProps = {
  children?: ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

type CommandInputProps = Omit<ComponentProps<"input">, "onChange" | "value"> & {
  onValueChange?: (value: string) => void;
  value?: string;
};

type CommandGroupProps = {
  children?: ReactNode;
  heading?: ReactNode;
};

type CommandItemProps = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  keywords?: string[];
  onPointerDown?: ComponentProps<"button">["onPointerDown"];
  onSelect?: () => void;
  value?: string;
};

type TestCommand = {
  description?: string;
  disabled?: boolean;
  group: "editor" | "bulk" | "help";
  id: string;
  keywords?: string[];
  label: string;
  run: () => void | Promise<void>;
  shortcutHint?: string;
};

mock.module("@/components/ui/Dialog", () => ({
  Dialog: ({ children, open = false }: DialogProps) =>
    open ? <div data-testid="dialog-shell">{children}</div> : null,
  DialogContent: ({
    children,
    hideCloseButton: _hideCloseButton,
    ...props
  }: DialogContentProps) => (
    <div role="dialog" aria-modal="true" {...props}>
      {children}
    </div>
  ),
  DialogDescription: ({ children, ...props }: ComponentProps<"p">) => (
    <p {...props}>{children}</p>
  ),
  DialogTitle: ({ children, ...props }: ComponentProps<"h2">) => (
    <h2 {...props}>{children}</h2>
  ),
}));

mock.module("cmdk", () => {
  const CommandRoot = ({ children, className, value }: CommandRootProps) => (
    <div
      className={className}
      data-selected-value={value ?? ""}
      data-testid="cmdk-root"
    >
      {children}
    </div>
  );

  const CommandInput = ({
    onValueChange,
    value,
    ...props
  }: CommandInputProps) => (
    <input
      {...props}
      value={value}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
    />
  );

  const CommandList = ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  );

  const CommandEmpty = ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  );

  const CommandGroup = ({ children, heading }: CommandGroupProps) => (
    <section>
      {heading ? <h3>{heading}</h3> : null}
      {children}
    </section>
  );

  const CommandItem = ({
    children,
    className,
    disabled,
    keywords: _keywords,
    onPointerDown,
    onSelect,
    value,
  }: CommandItemProps) => (
    <button
      type="button"
      role="option"
      aria-disabled={disabled ? "true" : undefined}
      className={className}
      data-value={value ?? ""}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onSelect?.();
        }
      }}
      onPointerDown={onPointerDown}
    >
      {children}
    </button>
  );

  return {
    Command: Object.assign(CommandRoot, {
      Empty: CommandEmpty,
      Group: CommandGroup,
      Input: CommandInput,
      Item: CommandItem,
      List: CommandList,
    }),
  };
});

let CommandPalette: typeof import("@/components/user/CommandPalette").CommandPalette;

function createCommands() {
  const openGuide = mock(() => undefined);
  const bulkActions = mock(() => undefined);
  const saveLayout = mock(() => undefined);

  return {
    commands: [
      {
        description: "Save your current layout",
        group: "editor",
        id: "save-layout",
        keywords: ["save", "persist"],
        label: "Save layout",
        run: saveLayout,
        shortcutHint: "Ctrl+S",
      },
      {
        description: "Toggle bulk actions toolbar",
        group: "bulk",
        id: "bulk-actions",
        keywords: ["bulk", "selection"],
        label: "Bulk actions",
        run: bulkActions,
      },
      {
        description: "Open the help guide",
        group: "help",
        id: "open-guide",
        keywords: ["guide", "docs"],
        label: "Open guide",
        run: openGuide,
      },
    ] satisfies TestCommand[],
    mocks: {
      bulkActions,
      openGuide,
      saveLayout,
    },
  };
}

function renderPalette(options?: {
  commands?: TestCommand[];
  onOpenChange?: ReturnType<typeof mock>;
  open?: boolean;
  recentStorageKey?: string;
}) {
  if (!CommandPalette) {
    throw new TypeError(
      "Expected CommandPalette to be loaded before rendering.",
    );
  }

  const onOpenChange = options?.onOpenChange ?? mock((open: boolean) => open);

  return {
    onOpenChange,
    ...render(
      <CommandPalette
        commands={options?.commands ?? []}
        onOpenChange={onOpenChange}
        open={options?.open ?? true}
        recentStorageKey={
          options?.recentStorageKey ?? "anicards:test:command-palette-recents"
        }
      />,
    ),
  };
}

beforeAll(async () => {
  ({ CommandPalette } = await import("@/components/user/CommandPalette"));
});

beforeEach(() => {
  resetHappyDom("https://anicards.test/user/Alpha49");
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("CommandPalette", () => {
  it("restores stored recent commands while filtering out stale history entries", async () => {
    const { commands } = createCommands();
    const recentStorageKey = "anicards:test:command-palette-recents";

    globalThis.window.localStorage.setItem(
      recentStorageKey,
      JSON.stringify([
        {
          at: 2,
          id: "bulk-actions",
          label: "Bulk actions",
        },
        {
          at: 1,
          id: "removed-command",
          label: "Removed command",
        },
      ]),
    );

    const view = renderPalette({ commands, recentStorageKey });

    await waitFor(() => {
      expect(view.getByText("Recent")).toBeTruthy();
    });

    expect(view.getAllByRole("option", { name: /bulk actions/i })).toHaveLength(
      2,
    );
    expect(view.queryByRole("option", { name: /removed command/i })).toBeNull();
    expect(view.getByText("Editor")).toBeTruthy();
    expect(view.getByText("Bulk Operations")).toBeTruthy();
    expect(view.getByText("Help & Guides")).toBeTruthy();
  });

  it("ignores malformed recent-command storage payloads", async () => {
    const { commands } = createCommands();
    const recentStorageKey = "anicards:test:command-palette-recents";

    globalThis.window.localStorage.setItem(recentStorageKey, "{not-json");

    const view = renderPalette({ commands, recentStorageKey });

    await waitFor(() => {
      expect(view.getByText("Editor")).toBeTruthy();
    });

    expect(view.queryByText("Recent")).toBeNull();
    expect(view.getByRole("option", { name: /save layout/i })).toBeTruthy();
  });

  it("closes, stores recents, and runs commands asynchronously after selection", async () => {
    const { commands, mocks } = createCommands();
    const recentStorageKey = "anicards:test:command-palette-recents";
    const onOpenChange = mock((open: boolean) => open);
    const view = renderPalette({
      commands,
      onOpenChange,
      recentStorageKey,
    });

    fireEvent.click(view.getByRole("option", { name: /bulk actions/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.bulkActions).not.toHaveBeenCalled();

    const storedRecentRaw =
      globalThis.window.localStorage.getItem(recentStorageKey);
    expect(storedRecentRaw).toBeTruthy();
    expect(JSON.parse(storedRecentRaw ?? "[]")).toEqual([
      expect.objectContaining({
        id: "bulk-actions",
        label: "Bulk actions",
      }),
    ]);

    await waitFor(() => {
      expect(mocks.bulkActions).toHaveBeenCalledTimes(1);
    });
  });

  it("logs rejected command executions without crashing the palette", async () => {
    const commandError = new Error("kaboom");
    const onOpenChange = mock((open: boolean) => open);
    const consoleError = mock(() => undefined);
    const originalConsoleError = console.error;

    console.error = consoleError as typeof console.error;

    try {
      const view = renderPalette({
        commands: [
          {
            group: "help",
            id: "explode",
            label: "Explode",
            run: mock(() => Promise.reject(commandError)),
          },
        ] satisfies TestCommand[],
        onOpenChange,
      });

      fireEvent.click(view.getByRole("option", { name: /explode/i }));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Command execution failed:",
          commandError,
        );
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
