import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import type { ReviewEntry } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "../comparative-distribution-stats/shared";

function computeReviewStats(
  reviews: ReviewEntry[] | undefined,
  mediaType: "ANIME" | "MANGA",
) {
  if (!Array.isArray(reviews))
    return {
      count: 0,
      avgRating: 0,
      avgScore: 0,
      genreMap: new Map<string, number>(),
    };

  const filtered = reviews.filter((r) => r.media.type === mediaType);
  const genreMap = new Map<string, number>();

  let totalRating = 0;
  let totalScore = 0;
  let ratingCount = 0;
  let scoreCount = 0;

  for (const review of filtered) {
    if (review.rating > 0) {
      totalRating += review.rating;
      ratingCount++;
    }
    if (review.score > 0) {
      totalScore += review.score;
      scoreCount++;
    }
    for (const genre of review.media.genres ?? []) {
      genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    }
  }

  return {
    count: filtered.length,
    avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
    avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
    genreMap,
  };
}

function buildMetrics(
  reviews: ReviewEntry[] | undefined,
  mediaType: "ANIME" | "MANGA",
): ComparativeMetricRow[] {
  const stats = computeReviewStats(reviews, mediaType);

  if (stats.count === 0) {
    return [
      { label: "Reviews", value: "0" },
      { label: "Avg. Rating", value: "N/A" },
    ];
  }

  return [
    { label: "Reviews", value: stats.count.toLocaleString("en-US") },
    { label: "Avg. Rating", value: `${stats.avgRating.toFixed(0)}` },
    { label: "Avg. Score", value: `${stats.avgScore.toFixed(0)}` },
  ];
}

function buildBars(
  reviews: ReviewEntry[] | undefined,
  mediaType: "ANIME" | "MANGA",
): ComparativeBarRow[] {
  const stats = computeReviewStats(reviews, mediaType);

  return [...stats.genreMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export interface ReviewStatsTemplateInput {
  username: string;
  variant?: "default";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  reviews: ReviewEntry[] | undefined;
}

export function reviewStatsTemplate(
  input: ReviewStatsTemplateInput,
): TrustedSVG {
  return comparativeTwoColumnTemplate({
    cardType: "reviewStats",
    username: input.username,
    title: "Review Statistics",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(input.reviews, "ANIME"),
      bars: buildBars(input.reviews, "ANIME"),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(input.reviews, "MANGA"),
      bars: buildBars(input.reviews, "MANGA"),
    },
  });
}
