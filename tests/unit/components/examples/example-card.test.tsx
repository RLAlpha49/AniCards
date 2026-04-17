import "@/tests/unit/__setup__";

import { cleanup, fireEvent, render } from "@testing-library/react";
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
import type { ComponentProps } from "react";

import { LIGHT_PREVIEW_COLOR_PRESET } from "@/lib/preview-theme";
import type { SettingsSnapshot } from "@/lib/user-page-settings-io";
import {
  LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
  PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
} from "@/lib/user-page-settings-templates";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const routerPush = mock((href: string) => Promise.resolve(href));
const toast = {
  error: mock(),
  success: mock(),
};

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
  viewport?: unknown;
  whileInView?: unknown;
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

mock.module("next/navigation", () => ({
  usePathname: () => "/examples",
  useRouter: () => ({
    push: routerPush,
    replace: mock((href: string) => Promise.resolve(href)),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

mock.module("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => {
      const divProps = omitStubProps(props, [
        "animate",
        "initial",
        "transition",
        "viewport",
        "whileInView",
      ] as const);

      return <div {...divProps}>{children}</div>;
    },
  },
}));

mock.module("sonner", () => ({ toast }));

mock.module("@/components/CardPreviewPlaceholder", () => ({
  CardPreviewPlaceholder: (props: ComponentProps<"div">) => <div {...props} />,
}));

mock.module("@/components/ImageWithSkeleton", () => ({
  ImageWithSkeleton: ({ alt, ...props }: ComponentProps<"img">) => (
    <img alt={alt} {...props} />
  ),
}));

installHappyDom();

let ExampleCard: typeof import("@/components/examples/ExampleCard").ExampleCard;

const BASE_SNAPSHOT: SettingsSnapshot = {
  colorPreset: "default",
  colors: ["#111111", "#222222", "#333333", "#444444"],
  borderEnabled: false,
  borderColor: "#e4e2e2",
  borderRadius: 8,
  advancedSettings: {
    useStatusColors: true,
    showPiePercentages: true,
    showFavorites: true,
    gridCols: 3,
    gridRows: 3,
  },
};

function createVariant(): ComponentProps<typeof ExampleCard>["variant"] {
  return {
    name: "Minimal",
    previewUrls: {
      light: "/card.svg?theme=light",
      dark: "/card.svg?theme=dark",
    },
    settingsSnapshots: {
      light: BASE_SNAPSHOT,
      dark: {
        ...BASE_SNAPSHOT,
        colorPreset: "anicardsDarkGradient",
      },
    },
    width: 1200,
    height: 630,
  };
}

function blockLocalStorageWrites() {
  const storage = globalThis.window.localStorage;
  const originalSetItem = storage.setItem.bind(storage);

  Object.defineProperty(storage, "setItem", {
    configurable: true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value: ((..._args: Parameters<typeof storage.setItem>) => {
      throw new Error("localStorage write blocked");
    }) as typeof storage.setItem,
  });

  return () => {
    Object.defineProperty(storage, "setItem", {
      configurable: true,
      value: originalSetItem,
    });
  };
}

describe("ExampleCard", () => {
  beforeAll(async () => {
    ({ ExampleCard } = await import("@/components/examples/ExampleCard"));
  });

  beforeEach(() => {
    resetHappyDom();
    routerPush.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    mock.restore();
    restoreHappyDom();
  });

  it("surfaces template save failures instead of queueing the style", () => {
    const restoreLocalStorage = blockLocalStorageWrites();

    try {
      const view = render(
        <ExampleCard
          variant={createVariant()}
          cardTypeTitle="Anime Stats"
          previewColorPreset={LIGHT_PREVIEW_COLOR_PRESET}
        />,
      );

      fireEvent.click(view.getByRole("button", { name: /use in editor/i }));

      expect(toast.error).toHaveBeenCalledWith("Couldn't save this style", {
        description:
          "Couldn't save template changes in this browser. Check storage permissions and try again.",
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(routerPush).not.toHaveBeenCalled();
      expect(
        globalThis.window.sessionStorage.getItem(
          PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
        ),
      ).toBeNull();
    } finally {
      restoreLocalStorage();
    }
  });

  it("reopens the remembered user editor route when one is available", () => {
    globalThis.window.sessionStorage.setItem(
      LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
      JSON.stringify({
        href: "/user/Alpha49",
        userId: "542244",
        username: "Alpha49",
        savedAt: Date.now(),
      }),
    );

    const view = render(
      <ExampleCard
        variant={createVariant()}
        cardTypeTitle="Anime Stats"
        previewColorPreset={LIGHT_PREVIEW_COLOR_PRESET}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /use in editor/i }));

    expect(routerPush).toHaveBeenCalledWith("/user/Alpha49");
    expect(toast.success).toHaveBeenCalledWith("Style queued for your editor", {
      description:
        "Jumping back into your last loaded editor so AniCards can apply it there.",
    });
    expect(
      globalThis.window.sessionStorage.getItem(
        PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      ),
    ).not.toBeNull();
  });
});
