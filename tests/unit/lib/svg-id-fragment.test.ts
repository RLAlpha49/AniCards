import { describe, expect, it } from "bun:test";
import { toSvgIdFragment } from "@/lib/svg-templates/completion-progress-stats/shared";

/**
 * `toSvgIdFragment` feeds both element ids and `url(#...)` references, so the
 * two consumers always agree. These cases pin the collapse and strip rules
 * that a future edit could change without any other test noticing.
 */
describe("toSvgIdFragment", () => {
  it("should lowercase and keep alphanumerics, underscores, and hyphens", () => {
    expect(toSvgIdFragment("Alpha49_Test")).toBe("alpha49_test");
  });

  it("should collapse a run of unsupported characters into one hyphen", () => {
    expect(toSvgIdFragment("a   b")).toBe("a-b");
    expect(toSvgIdFragment("a!!!b")).toBe("a-b");
  });

  it("should collapse runs of hyphens, including those next to separators", () => {
    // The class keeps hyphens, so "a - b" would otherwise yield "a---b".
    expect(toSvgIdFragment("a - b")).toBe("a-b");
    expect(toSvgIdFragment("a--b")).toBe("a-b");
  });

  it("should strip a leading and trailing hyphen", () => {
    expect(toSvgIdFragment("-abc-")).toBe("abc");
    expect(toSvgIdFragment("  abc  ")).toBe("abc");
    expect(toSvgIdFragment("---abc---")).toBe("abc");
  });

  it("should truncate to 48 characters", () => {
    const long = "a".repeat(60);
    expect(toSvgIdFragment(long)).toHaveLength(48);
  });

  it("should return an empty string for blank and non-string input", () => {
    expect(toSvgIdFragment("")).toBe("");
    expect(toSvgIdFragment("   ")).toBe("");
    expect(toSvgIdFragment(undefined as unknown as string)).toBe("");
  });

  it("should produce output safe to embed in an id and a url() reference", () => {
    const fragment = toSvgIdFragment('user "quoted" & <angle>');
    expect(fragment).not.toMatch(/["&<>\s]/);
    expect(fragment).toBe("user-quoted-angle");
  });
});
