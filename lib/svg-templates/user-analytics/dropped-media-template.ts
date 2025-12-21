import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import type { MediaListEntry } from "@/lib/types/records";
import {
  comparativeTwoColumnTemplate,
  type ComparativeBarRow,
  type ComparativeMetricRow,
} from "../comparative-distribution-stats/shared";

function computeDropStats(entries: MediaListEntry[] | undefined) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { count: 0, avgProgress: 0, genreMap: new Map<string, number>() };
  }

  let totalProgress = 0;
  let progressCount = 0;
  const genreMap = new Map<string, number>();

  for (const entry of entries) {
    const progress = entry.progress ?? 0;
    const rawTotal = entry.media.episodes ?? entry.media.chapters;
    const total =
      typeof rawTotal === "number" && rawTotal > 0 ? rawTotal : undefined;

    if (progress > 0 && typeof total === "number") {
      const pct = Math.min((progress / total) * 100, 100);
      totalProgress += pct;
      progressCount++;
    }

    for (const genre of entry.media.genres ?? []) {
      genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    }
  }

  return {
    count: entries.length,
    avgProgress: progressCount > 0 ? totalProgress / progressCount : null,
    genreMap,
  };
}

function buildMetrics(
  entries: MediaListEntry[] | undefined,
): ComparativeMetricRow[] {
  const stats = computeDropStats(entries);

  if (stats.count === 0) {
    return [
      { label: "Dropped", value: "0" },
      { label: "Avg. Progress", value: "N/A" },
    ];
  }

  const avgLabel =
    stats.avgProgress === null ? "N/A" : `${stats.avgProgress.toFixed(0)}%`;

  return [
    { label: "Dropped", value: stats.count.toLocaleString("en-US") },
    { label: "Avg. Progress", value: avgLabel },
  ];
}

function buildBars(entries: MediaListEntry[] | undefined): ComparativeBarRow[] {
  const stats = computeDropStats(entries);

  return [...stats.genreMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export interface DroppedMediaTemplateInput {
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
  animeDropped: MediaListEntry[] | undefined;
  mangaDropped: MediaListEntry[] | undefined;
}

export function droppedMediaTemplate(
  input: DroppedMediaTemplateInput,
): TrustedSVG {
  return comparativeTwoColumnTemplate({
    cardType: "droppedMedia",
    username: input.username,
    title: "Dropped Media",
    variant: input.variant,
    styles: input.styles,
    left: {
      title: "Anime",
      metrics: buildMetrics(input.animeDropped),
      bars: buildBars(input.animeDropped),
    },
    right: {
      title: "Manga",
      metrics: buildMetrics(input.mangaDropped),
      bars: buildBars(input.mangaDropped),
    },
  });
}
