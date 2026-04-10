import { describe, expect, it } from "bun:test";

import {
  DEFAULT_STAT_BASE_COLOR,
  resolveCircleBaseColor,
} from "@/lib/svg-templates/common/color-utils";
import type { ColorValue, GradientDefinition } from "@/lib/types/card";
import { generateGradientSVG, processColorsForSVG } from "@/lib/utils";

describe("SVG gradient render hardening", () => {
  it("falls back to the first safe stop color when a runtime gradient is malformed", () => {
    const maliciousGradient = {
      type: "linear",
      angle: 45,
      stops: [
        { color: "#112233", offset: 0 },
        {
          color:
            '#445566" stop-opacity="1" /><script>alert(1)</script><stop stop-color="#000000',
          offset: 100,
        },
      ],
    } as unknown as ColorValue;

    const result = processColorsForSVG({ titleColor: maliciousGradient }, [
      "titleColor",
    ]);

    expect(result.gradientDefs).toBe("");
    expect(result.gradientIds).toEqual({});
    expect(result.resolvedColors.titleColor).toBe("#112233");
  });

  it("coerces gradient attributes before serializing SVG markup", () => {
    const svg = generateGradientSVG(
      {
        type: "radial",
        cx: "150",
        cy: -10,
        r: "75",
        stops: [
          { color: "#abcdef", offset: -25, opacity: 1.5 },
          { color: "#fedcba", offset: 100, opacity: "oops" },
        ],
      } as unknown as GradientDefinition,
      'grad"bad<&',
    );

    expect(svg).toContain(
      '<radialGradient id="grad&quot;bad&lt;&amp;" cx="100%" cy="0%" r="75%">',
    );
    expect(svg).toContain(
      '<stop offset="0%" stop-color="#abcdef" stop-opacity="1"/>',
    );
    expect(svg).toContain('<stop offset="100%" stop-color="#fedcba"/>');
    expect(svg).not.toContain("<script");
  });

  it("falls back to the default title color for invalid JSON-encoded gradients", () => {
    const invalidJsonGradient = JSON.stringify({
      type: "linear",
      stops: [
        { color: 'bad" /><script>alert(1)</script>', offset: "0%" },
        { color: "also-bad", offset: 100 },
      ],
    });

    const result = processColorsForSVG(
      { titleColor: invalidJsonGradient as unknown as ColorValue },
      ["titleColor"],
    );

    expect(result.gradientDefs).toBe("");
    expect(result.resolvedColors.titleColor).toBe("#fe428e");
  });

  it("reuses the hardened gradient fallback when resolving stat base colors", () => {
    const malformedGradientJson = JSON.stringify({
      type: "linear",
      stops: [
        { color: 'not-a-color" /><script>alert(1)</script>', offset: 0 },
        { color: "#22cc88", offset: "100%" },
      ],
    });

    expect(resolveCircleBaseColor(malformedGradientJson)).toBe("#22cc88");
    expect(resolveCircleBaseColor('{"type":"linear","stops":[]}')).toBe(
      DEFAULT_STAT_BASE_COLOR,
    );
  });
});
