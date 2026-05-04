import { beforeAll, describe, expect, it, mock } from "bun:test";
import type { ComponentProps, ReactNode } from "react";
import { createElement } from "react";

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
};

mock.module("@/components/ui/Motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: MotionDivProps) =>
      createElement("div", props, children),
  },
  NO_MOTION_TRANSITION: { duration: 0 },
}));

let createDownloadSummary: typeof import("@/components/user/bulk/DownloadStatusAlerts").createDownloadSummary;
let getDownloadSummaryTitle: typeof import("@/components/user/bulk/DownloadStatusAlerts").getDownloadSummaryTitle;

beforeAll(async () => {
  ({ createDownloadSummary, getDownloadSummaryTitle } =
    await import("@/components/user/bulk/DownloadStatusAlerts"));
});

describe("bulk download feedback summary", () => {
  it("keeps skipped disabled cards separate from failed conversions", () => {
    const summary = createDownloadSummary({
      requestedTotal: 5,
      exported: 3,
      failed: 1,
      failedCardRawTypes: ["animeStats-default"],
      skippedDisabledCardRawTypes: ["socialStats-default"],
    });

    expect(summary).toEqual({
      requestedTotal: 5,
      exported: 3,
      failed: 1,
      skippedDisabled: 1,
      failedCardRawTypes: ["animeStats-default"],
      skippedDisabledCardRawTypes: ["socialStats-default"],
    });
    expect(getDownloadSummaryTitle(summary)).toBe(
      "Exported 3/5 selected (1 failed, 1 skipped disabled)",
    );
  });

  it("reports all-disabled selections as skipped instead of failed", () => {
    const summary = createDownloadSummary({
      requestedTotal: 2,
      skippedDisabledCardRawTypes: [
        "animeStats-default",
        "socialStats-default",
      ],
    });

    expect(summary.failed).toBe(0);
    expect(summary.skippedDisabled).toBe(2);
    expect(summary.failedCardRawTypes).toBeUndefined();
    expect(getDownloadSummaryTitle(summary)).toBe(
      "Skipped 2 disabled selected cards",
    );
  });
});
