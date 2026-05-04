import { describe, expect, it } from "bun:test";

import {
  shouldAutoStartTour,
  TOUR_DISMISS_COOLDOWN_MS,
} from "@/components/user/editor/tour-utils";

function createShouldAutoStartArgs(
  overrides: Partial<Parameters<typeof shouldAutoStartTour>[0]> = {},
): Parameters<typeof shouldAutoStartTour>[0] {
  return {
    isNewUser: true,
    isTourCompleted: false,
    isTourRunning: false,
    lastDismissedAt: null,
    nowMs: 10_000,
    cooldownMs: TOUR_DISMISS_COOLDOWN_MS,
    ...overrides,
  };
}

describe("tour-utils", () => {
  for (const scenario of [
    {
      title: "returns false when the viewer is not a new user",
      overrides: { isNewUser: false },
    },
    {
      title: "returns false when the tour has already been completed",
      overrides: { isTourCompleted: true },
    },
    {
      title: "returns false when the tour is already running",
      overrides: { isTourRunning: true },
    },
  ] as const) {
    it(scenario.title, () => {
      const shouldAutoStart = shouldAutoStartTour(
        createShouldAutoStartArgs(scenario.overrides),
      );

      expect(shouldAutoStart).toBe(false);
    });
  }

  it("suppresses auto-start while the dismissal cooldown is still active", () => {
    const shouldAutoStart = shouldAutoStartTour(
      createShouldAutoStartArgs({
        nowMs: 5_000,
        cooldownMs: 2_000,
        lastDismissedAt: 3_500,
      }),
    );

    expect(shouldAutoStart).toBe(false);
  });

  it("allows auto-start again once the dismissal cooldown boundary is reached", () => {
    const shouldAutoStart = shouldAutoStartTour(
      createShouldAutoStartArgs({
        nowMs: 5_000,
        cooldownMs: 2_000,
        lastDismissedAt: 3_000,
      }),
    );

    expect(shouldAutoStart).toBe(true);
  });

  it("ignores non-finite dismissal timestamps from corrupted storage", () => {
    const shouldAutoStart = shouldAutoStartTour(
      createShouldAutoStartArgs({
        lastDismissedAt: Number.NaN,
      }),
    );

    expect(shouldAutoStart).toBe(true);
  });
});
