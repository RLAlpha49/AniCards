"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGeneratorContext } from "./generator-context";

export function AdvancedOptions() {
  const {
    useAnimeStatusColors,
    useMangaStatusColors,
    showPiePercentages,
    handleToggleAnimeStatusColors,
    handleToggleMangaStatusColors,
    handleToggleShowPiePercentages,
  } = useGeneratorContext();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold">Advanced Options</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-500">
              Status Colors
            </Label>
            <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
              <div className="space-y-0.5">
                <Label className="text-base">Anime Status Colors</Label>
                <p className="text-xs text-muted-foreground">
                  Use fixed colors for status distribution
                </p>
              </div>
              <Switch
                checked={useAnimeStatusColors}
                onCheckedChange={handleToggleAnimeStatusColors}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
              <div className="space-y-0.5">
                <Label className="text-base">Manga Status Colors</Label>
                <p className="text-xs text-muted-foreground">
                  Use fixed colors for status distribution
                </p>
              </div>
              <Switch
                checked={useMangaStatusColors}
                onCheckedChange={handleToggleMangaStatusColors}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-500">
              Chart Options
            </Label>
            <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
              <div className="space-y-0.5">
                <Label className="text-base">Pie Percentages</Label>
                <p className="text-xs text-muted-foreground">
                  Show percentages in legends
                </p>
              </div>
              <Switch
                checked={showPiePercentages}
                onCheckedChange={handleToggleShowPiePercentages}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/30 dark:bg-blue-900/10">
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
            <span className="text-xs font-bold">i</span>
          </div>
          <div className="space-y-1 text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium">Status Color Guide</p>
            <p className="text-blue-700 dark:text-blue-300">
              Current=🟢, Paused=🟡, Completed=🔵, Dropped=🔴, Planning=⚪
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
