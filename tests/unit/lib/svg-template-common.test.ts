import { describe, expect, it } from "bun:test";

import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import {
  DEFAULT_STAT_BASE_COLOR,
  getColorByIndex,
  getStatColor,
  resolveCircleBaseColor,
  tryParseJsonGradient,
} from "@/lib/svg-templates/common/color-utils";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import {
  generateCommonStyles,
  generateRankCircleStyles,
} from "@/lib/svg-templates/common/style-generators";
import {
  createGroupElement,
  createRectElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";
import {
  calculateCompletionRatio,
  dedupeByMediaIdKeepHighestRepeat,
  generateStackedBar,
  generateStatusLegend,
  getDimensions,
  getMediaTitle,
  normalizeStatusCounts,
  truncateWithEllipsis,
} from "@/lib/svg-templates/completion-progress-stats/shared";
import {
  generateFavouritesSummaryBody,
  getFavouriteCounts,
  getVariantLabel,
} from "@/lib/svg-templates/profile-favorite-stats/shared";

function countMatches(input: string, pattern: RegExp): number {
  const regex = new RegExp(pattern.source, pattern.flags);
  let matchCount = 0;

  while (regex.exec(input)) {
    matchCount += 1;
  }

  return matchCount;
}

describe("svg template common utilities", () => {
  it("serializes card backgrounds with and without border strokes", () => {
    const withBorder = generateCardBackground({ w: 300, h: 150 }, 12, {
      backgroundColor: "#0f172a",
      borderColor: "#38bdf8",
    });

    const withoutBorder = generateCardBackground({ w: 280, h: 195 }, 8, {
      backgroundColor: "#111827",
      borderColor: "",
    });

    expect(withBorder).toContain('data-testid="card-bg"');
    expect(withBorder).toContain('width="299"');
    expect(withBorder).toContain('height="149"');
    expect(withBorder).toContain('stroke="#38bdf8"');
    expect(withoutBorder).not.toContain('stroke="#');
  });

  it("resolves fallback colors from gradients, JSON strings, and fixed mappings", () => {
    const gradient = {
      type: "linear",
      angle: 45,
      stops: [
        { color: "#112233", offset: 0 },
        { color: "#445566", offset: 100 },
      ],
    };

    expect(tryParseJsonGradient(JSON.stringify(gradient))).toEqual({
      color: "#112233",
    });
    expect(
      resolveCircleBaseColor(
        gradient as Parameters<typeof resolveCircleBaseColor>[0],
      ),
    ).toBe("#112233");
    expect(
      resolveCircleBaseColor(
        JSON.stringify(gradient) as Parameters<
          typeof resolveCircleBaseColor
        >[0],
      ),
    ).toBe("#112233");
    expect(resolveCircleBaseColor("not-a-color")).toBe(DEFAULT_STAT_BASE_COLOR);
    expect(getStatColor(0, "paused", "#336699", true)).toBe("#ca8a04");
    expect(getStatColor(1, "custom", "#336699", false)).toBe(
      getColorByIndex(1, "#336699"),
    );
  });

  it("cycles derived colors and falls back to default dimensions safely", () => {
    expect(getColorByIndex(0, "#336699")).toBe(getColorByIndex(5, "#336699"));
    expect(getCardDimensions("mediaStats", "missing-variant")).toEqual({
      w: 450,
      h: 195,
    });
    expect(
      getCardDimensions("statusCompletionOverview", "missing-variant"),
    ).toEqual({
      w: 400,
      h: 150,
    });
    expect(getDimensions("unknown-card", "whatever")).toEqual({
      w: 400,
      h: 200,
    });
  });

  it("builds common style blocks and escaped svg primitives", () => {
    const resolvedColors = {
      titleColor: "#ffffff",
      backgroundColor: "#111827",
      textColor: "#e5e7eb",
      circleColor: "#38bdf8",
    };

    const commonStyles = generateCommonStyles(resolvedColors, 18, {
      includeFadeIn: false,
      includeRankCircle: true,
      includeStagger: false,
    });
    const rankCircleStyles = generateRankCircleStyles(
      "#38bdf8",
      "90.00",
      "45.00",
    );
    const rankCircleWithoutDash = generateRankCircleStyles(
      "#38bdf8",
      null,
      null,
    );
    const text = createTextElement(10, 12, "Alice & Bob <3", "stat", {
      fill: "#fff",
      fontSize: 14,
      fontWeight: 600,
      textAnchor: "end",
    });
    const rect = createRectElement(1, 2, 3, 4, {
      rx: 5,
      fill: "#111",
      stroke: "#222",
      strokeWidth: 1,
      opacity: 0.5,
      className: "box",
    });
    const group = createGroupElement("translate(1,2)", "<text />", {
      className: "wrap",
      dataTestId: "alpha",
      animationDelay: "120ms",
    });
    const staggered = createStaggeredGroup(
      "translate(0,0)",
      "<text />",
      "240ms",
    );

    expect(commonStyles).not.toContain("@keyframes fadeInAnimation");
    expect(commonStyles).not.toContain(".stagger {");
    expect(commonStyles).toContain(".rank-circle-rim");
    expect(rankCircleStyles).toContain("stroke-dasharray: 90.00");
    expect(rankCircleStyles).toContain("to { stroke-dashoffset: 45.00; }");
    expect(rankCircleWithoutDash).toContain("animation: none");
    expect(text).toContain('text-anchor="end"');
    expect(text).toContain("Alice &amp; Bob &lt;3");
    expect(rect).toContain('opacity="0.5"');
    expect(rect).toContain('class="box"');
    expect(group).toContain('data-testid="alpha"');
    expect(group).toContain('style="animation-delay:120ms"');
    expect(staggered).toContain('class="stagger"');
    expect(staggered).toContain('style="animation-delay:240ms"');
  });
});

describe("svg template shared helper modules", () => {
  it("normalizes statuses and generates stacked bar and legend markup", () => {
    const statuses = [
      { status: "WATCHING", count: 2 },
      { status: "READING", count: 1 },
      { status: "COMPLETED", count: 5 },
      { status: "ON_HOLD", count: 4 },
      { status: "DROPPED", count: 2 },
      { status: "CURRENT", count: Number.NaN },
    ];

    const normalized = normalizeStatusCounts(statuses);
    const completionRatio = calculateCompletionRatio(normalized);
    const stackedBar = generateStackedBar(statuses, {
      x: 10,
      y: 20,
      width: 200,
      height: 14,
      label: "Anime Statuses",
      textColor: "#ffffff",
      trackColor: "#111827",
    });
    const legend = generateStatusLegend(
      [
        ...statuses,
        { status: "PLANNING", count: 3 },
        { status: "REPEATING", count: 1 },
      ],
      0,
      0,
      "#ffffff",
    );

    expect(normalized).toEqual([
      { status: "COMPLETED", count: 5 },
      { status: "CURRENT", count: 3 },
      { status: "PAUSED", count: 4 },
      { status: "DROPPED", count: 2 },
    ]);
    expect(completionRatio).toEqual({
      completedCount: 5,
      totalCount: 14,
      percentage: "35.7",
    });
    expect(stackedBar).toContain(
      'clipPath id="bar-clip-anime-statuses-10-20-200-14"',
    );
    expect(stackedBar).toContain('fill="#2ecc71"');
    expect(stackedBar).toContain('fill="#3498db"');
    expect(legend).toContain("Completed: 5");
    expect(countMatches(legend, /class="legend-text"/g)).toBe(6);
  });

  it("deduplicates media entries, truncates labels, and summarizes favourites", () => {
    type MediaEntry = Parameters<
      typeof dedupeByMediaIdKeepHighestRepeat
    >[0][number];

    const entries: MediaEntry[] = [
      {
        media: {
          id: 1,
          title: {
            english: "English Title",
            romaji: "",
            native: "",
          },
        },
        repeat: 1,
      } as unknown as MediaEntry,
      {
        media: {
          id: 1,
          title: {
            english: "English Title",
            romaji: "",
            native: "",
          },
        },
        repeat: 3,
      } as unknown as MediaEntry,
      {
        media: {
          id: 2,
          title: {
            english: "",
            romaji: "Romaji Title",
            native: "",
          },
        },
        repeat: 0,
      } as unknown as MediaEntry,
      {
        media: {
          title: {
            english: "Ignored",
            romaji: "",
            native: "",
          },
        },
        repeat: 99,
      } as unknown as MediaEntry,
    ];

    const [firstEntry] = entries;

    if (!firstEntry) {
      throw new Error("Expected a seeded media entry for the SVG helper test");
    }

    const favourites = {
      anime: {
        pageInfo: { total: 10 },
        nodes: [{ id: 1 }],
      },
      manga: {
        nodes: [{ id: 1 }, { id: 2 }],
      },
      characters: {
        pageInfo: { total: 3 },
        nodes: [],
      },
      staff: {
        nodes: [{ id: 1 }],
      },
      studios: {
        nodes: [],
      },
    } as unknown as Parameters<typeof getFavouriteCounts>[0];

    const counts = getFavouriteCounts(favourites);
    const summary = generateFavouritesSummaryBody(counts, {
      titleColor: "#ffffff",
      backgroundColor: "#111827",
      textColor: "#e5e7eb",
      circleColor: "#38bdf8",
    });

    expect(dedupeByMediaIdKeepHighestRepeat(entries)).toHaveLength(2);
    expect(getMediaTitle(firstEntry)).toBe("English Title");
    expect(
      getMediaTitle({
        media: {
          title: {
            english: "",
            romaji: "",
            native: "Native Title",
          },
        },
      } as unknown as MediaEntry),
    ).toBe("Native Title");
    expect(
      getMediaTitle({
        media: {
          title: {
            english: "",
            romaji: "",
            native: "",
          },
        },
      } as unknown as MediaEntry),
    ).toBe("Unknown");
    expect(truncateWithEllipsis("Long favorite label", 8)).toBe("Long fa…");
    expect(counts).toEqual({
      anime: 10,
      manga: 2,
      characters: 3,
      staff: 1,
      studios: 0,
    });
    expect(summary).toContain(
      '<text class="total-count" x="0" y="20">16</text>',
    );
    expect(summary).toContain(
      '<text class="stat-value" x="0" y="12">10</text>',
    );
    expect(summary).toContain("Anime");
    expect(getVariantLabel("staff")).toBe("Staff");
    expect(getVariantLabel("unknown")).toBe("Favorites");
  });
});
