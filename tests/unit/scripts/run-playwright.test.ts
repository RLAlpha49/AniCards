import { describe, expect, it } from "bun:test";

import {
  resolvePlaywrightRunConfiguration,
  shouldEnableFullMatrix,
} from "../../../scripts/run-playwright";

describe("run-playwright", () => {
  it("keeps the default test run on chromium only", () => {
    expect(shouldEnableFullMatrix(["--grep", "home"])).toBe(false);
    expect(
      resolvePlaywrightRunConfiguration("test-e2e", ["--grep", "home"]),
    ).toEqual({});
  });

  it("enables the full matrix when a non-chromium project is requested", () => {
    expect(shouldEnableFullMatrix(["--project=mobile-chrome"])).toBe(true);
    expect(
      resolvePlaywrightRunConfiguration("test-e2e", [
        "--project=mobile-chrome",
      ]),
    ).toEqual({
      envOverrides: {
        PLAYWRIGHT_FULL_MATRIX: "1",
      },
    });
  });

  it("enables the full matrix for the Firefox route-suite lane", () => {
    const firefoxRouteSuiteArgs = [
      "tests/e2e/search",
      "tests/e2e/user",
      "--project=firefox",
    ];

    expect(shouldEnableFullMatrix(firefoxRouteSuiteArgs)).toBe(true);
    expect(
      resolvePlaywrightRunConfiguration("test-e2e", firefoxRouteSuiteArgs),
    ).toEqual({
      envOverrides: {
        PLAYWRIGHT_FULL_MATRIX: "1",
      },
    });
  });

  it("does not enable the matrix for chromium-only filters", () => {
    expect(shouldEnableFullMatrix(["--project", "chromium"])).toBe(false);
  });
});
