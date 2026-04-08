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

function MotionHeader({
  animate,
  children,
  initial,
  transition,
  variants,
  ...props
}: MotionProps<"header">) {
  void animate;
  void initial;
  void transition;
  void variants;

  return <header {...props}>{children}</header>;
}

function MotionDiv({
  animate,
  children,
  initial,
  transition,
  variants,
  ...props
}: MotionProps<"div">) {
  void animate;
  void initial;
  void transition;
  void variants;

  return <div {...props}>{children}</div>;
}

function MotionH1({
  animate,
  children,
  initial,
  transition,
  variants,
  ...props
}: MotionProps<"h1">) {
  void animate;
  void initial;
  void transition;
  void variants;

  return <h1 {...props}>{children}</h1>;
}

function MotionP({
  animate,
  children,
  initial,
  transition,
  variants,
  ...props
}: MotionProps<"p">) {
  void animate;
  void initial;
  void transition;
  void variants;

  return <p {...props}>{children}</p>;
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
});
