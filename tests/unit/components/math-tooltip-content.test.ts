import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import { containsMath } from "@/components/MathTooltipContent";

describe("MathTooltipContent", () => {
  it("detects inline and display math while ignoring plain currency-like values", () => {
    expect(containsMath("Use $x^2$ for the curve.")).toBe(true);
    expect(containsMath("Display $$x^2 + y^2 = z^2$$ in the tooltip.")).toBe(
      true,
    );
    expect(containsMath("This upgrade costs $20 and ships tomorrow.")).toBe(
      false,
    );
    expect(containsMath("No formulas here, just helpful words.")).toBe(false);
  });
});
