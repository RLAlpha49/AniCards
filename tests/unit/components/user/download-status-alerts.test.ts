import { describe, expect, it } from "bun:test";

import {
  createDownloadSummary,
  getDownloadSummaryTitle,
} from "@/components/user/bulk/DownloadStatusAlerts";

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
