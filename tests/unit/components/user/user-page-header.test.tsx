import "@/tests/unit/__setup__";

import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type MotionTag = "div" | "h1" | "header" | "p";

type MotionProps<T extends MotionTag> = ComponentProps<T> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
  variants?: unknown;
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

function MotionHeader({ children, ...props }: MotionProps<"header">) {
  const headerProps = omitStubProps(props, [
    "animate",
    "initial",
    "transition",
    "variants",
  ] as const);

  return <header {...headerProps}>{children}</header>;
}

function MotionDiv({ children, ...props }: MotionProps<"div">) {
  const divProps = omitStubProps(props, [
    "animate",
    "initial",
    "transition",
    "variants",
  ] as const);

  return <div {...divProps}>{children}</div>;
}

function MotionH1({ children, ...props }: MotionProps<"h1">) {
  const headingProps = omitStubProps(props, [
    "animate",
    "initial",
    "transition",
    "variants",
  ] as const);

  return <h1 {...headingProps}>{children}</h1>;
}

function MotionP({ children, ...props }: MotionProps<"p">) {
  const paragraphProps = omitStubProps(props, [
    "animate",
    "initial",
    "transition",
    "variants",
  ] as const);

  return <p {...paragraphProps}>{children}</p>;
}

mock.module("framer-motion", () => ({
  motion: {
    div: MotionDiv,
    h1: MotionH1,
    header: MotionHeader,
    p: MotionP,
  },
}));

afterEach(() => {
  mock.restore();
});

describe("UserPageHeader", () => {
  it("keeps long usernames wrappable on mobile while preserving the full title text", async () => {
    const { UserPageHeader } = await import("@/components/user/UserPageHeader");
    const longUsername = "VeryLongAniListUsername".repeat(8);

    const markup = renderToStaticMarkup(
      <UserPageHeader username={longUsername} userId="123" />,
    );

    expect(markup).toContain(`title="${longUsername}"`);
    expect(markup).toContain("wrap-anywhere");
    expect(markup).toContain("sm:wrap-break-word");
    expect(markup).toContain("min-w-0");
  });

  it("keeps dynamic save timing visible while limiting live announcements to discrete save states", async () => {
    const { UserPageHeader } = await import("@/components/user/UserPageHeader");
    const queuedMarkup = renderToStaticMarkup(
      <UserPageHeader
        username="TestUser"
        userId="123"
        saveState={{
          autoSaveDueAt: Date.now() + 4_000,
          isAutoSaveQueued: true,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          saveError: null,
        }}
      />,
    );

    expect(queuedMarkup).toContain('aria-live="polite"');
    expect(queuedMarkup).toContain("Auto-save queued.");
    expect(queuedMarkup).toContain('aria-hidden="true"');
    expect(queuedMarkup).toContain("Auto-save in");

    const savedMarkup = renderToStaticMarkup(
      <UserPageHeader
        username="TestUser"
        userId="123"
        saveState={{
          isAutoSaveQueued: false,
          isDirty: false,
          isSaving: false,
          lastSavedAt: Date.now() - 120_000,
          saveError: null,
        }}
      />,
    );

    expect(savedMarkup).toContain("Saved and synced.");
    expect(savedMarkup).toContain("Saved");
    expect(savedMarkup).toContain("ago");
    expect(savedMarkup).toContain("Synced");
  });
});
