import { describe, expect, it } from "bun:test";
import type { DriveStep } from "driver.js";

import { findActiveStepIndex } from "@/components/user/editor/EditorTour";

type TestDriveStep = DriveStep & { id?: string };

function createDriveStep(
  overrides: Partial<TestDriveStep> = {},
): TestDriveStep {
  return {
    popover: {
      title: "Tour Step",
      description: "Description",
    },
    ...overrides,
  };
}

describe("EditorTour findActiveStepIndex", () => {
  it("returns -1 when there is no active step", () => {
    const index = findActiveStepIndex([
      createDriveStep({ id: "intro" }),
      createDriveStep({ id: "filters" }),
    ]);

    expect(index).toBe(-1);
  });

  it("matches the active step by explicit stable id", () => {
    const resolvedSteps = [
      createDriveStep({ id: "intro" }),
      createDriveStep({ id: "filters" }),
      createDriveStep({ id: "finish" }),
    ];

    const index = findActiveStepIndex(
      resolvedSteps,
      createDriveStep({
        id: "filters",
        popover: {
          title: "Different title, same id",
          description: "Description",
        },
      }),
    );

    expect(index).toBe(1);
  });

  it("matches a title-derived active step when driver does not provide an explicit id", () => {
    const resolvedSteps = [
      createDriveStep({ id: "welcome-step" }),
      createDriveStep({ id: "filter-controls" }),
    ];

    const index = findActiveStepIndex(
      resolvedSteps,
      createDriveStep({
        popover: {
          title: "Filter Controls",
          description: "Description",
        },
      }),
    );

    expect(index).toBe(1);
  });

  it("falls back to element and title matching for legacy driver steps without ids", () => {
    const legacyElement = "[data-tour=card-enable-toggle]";
    const resolvedSteps = [
      createDriveStep({
        element: legacyElement,
        popover: {
          title: "Enable cards",
          description: "Description",
        },
      }),
      createDriveStep({
        element: "[data-tour=card-preview]",
        popover: {
          title: "Preview",
          description: "Description",
        },
      }),
    ];

    const index = findActiveStepIndex(
      resolvedSteps,
      createDriveStep({
        element: legacyElement,
        popover: {
          title: "Enable cards",
          description: "Changed description should not matter",
        },
      }),
    );

    expect(index).toBe(0);
  });
});
