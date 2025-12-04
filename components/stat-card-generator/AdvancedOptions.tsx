"use client";

import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { useGeneratorContext } from "./GeneratorContext";
import {
  Settings2,
  Palette,
  PieChart,
  Info,
  Film,
  BookOpen,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType, SVGProps } from "react";

type OptionListItem = {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked?: boolean) => void;
  color?: string;
};

type OptionListGroupProps = {
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  headerGradientClasses?: string;
  items: OptionListItem[];
  groupDelay?: number;
  itemDelayStart?: number;
};

const colorClasses: Record<
  string,
  { checkedContainer: string; checkedIcon: string; switchClass: string }
> = {
  blue: {
    checkedContainer:
      "border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-800/50 dark:bg-blue-900/20",
    checkedIcon: "bg-blue-500 shadow-md shadow-blue-500/25",
    switchClass: "data-[state=checked]:bg-blue-500",
  },
  purple: {
    checkedContainer:
      "border-purple-200 bg-purple-50/80 shadow-sm dark:border-purple-800/50 dark:bg-purple-900/20",
    checkedIcon: "bg-purple-500 shadow-md shadow-purple-500/25",
    switchClass: "data-[state=checked]:bg-purple-500",
  },
  emerald: {
    checkedContainer:
      "border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-900/20",
    checkedIcon: "bg-emerald-500 shadow-md shadow-emerald-500/25",
    switchClass: "data-[state=checked]:bg-emerald-500",
  },
  amber: {
    checkedContainer:
      "border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-800/50 dark:bg-amber-900/20",
    checkedIcon: "bg-amber-500 shadow-md shadow-amber-500/25",
    switchClass: "data-[state=checked]:bg-amber-500",
  },
  gray: {
    checkedContainer:
      "border-slate-200 bg-slate-50/80 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/20",
    checkedIcon: "bg-slate-500 shadow-md shadow-slate-500/25",
    switchClass: "data-[state=checked]:bg-slate-500",
  },
};

function OptionListGroup({
  title,
  Icon,
  headerGradientClasses = "",
  items,
  groupDelay = 0,
  itemDelayStart = 0,
}: Readonly<OptionListGroupProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: groupDelay }}
      className="space-y-3 rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-50/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80"
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg shadow-md shadow-slate-700/25",
            headerGradientClasses,
          )}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {title}
        </Label>
      </div>

      <div className="space-y-2.5">
        {items.map((option, index) => {
          const classes =
            colorClasses[option.color ?? "blue"] ?? colorClasses.blue;
          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.2,
                delay: itemDelayStart + index * 0.05,
              }}
              className={cn(
                "group flex items-center justify-between rounded-xl border p-3.5 transition-all",
                option.checked
                  ? classes.checkedContainer
                  : "border-slate-200/50 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:border-slate-600",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    option.checked
                      ? classes.checkedIcon
                      : "bg-slate-100 group-hover:bg-slate-200 dark:bg-slate-700 dark:group-hover:bg-slate-600",
                  )}
                >
                  <option.icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      option.checked
                        ? "text-white"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold text-slate-900 dark:text-white">
                    {option.label}
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {option.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={option.checked}
                onCheckedChange={option.onChange}
                className={classes.switchClass}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AdvancedOptionsComponent() {
  const {
    useAnimeStatusColors,
    useMangaStatusColors,
    showPiePercentages,
    handleToggleAnimeStatusColors,
    handleToggleMangaStatusColors,
    handleToggleShowPiePercentages,
  } = useGeneratorContext();

  // Define option items for cleaner rendering
  const statusColorOptions = [
    {
      id: "anime-status",
      icon: Film,
      label: "Anime Status Colors",
      description: "Use fixed colors for anime status distribution",
      checked: useAnimeStatusColors,
      onChange: handleToggleAnimeStatusColors,
      color: "blue",
    },
    {
      id: "manga-status",
      icon: BookOpen,
      label: "Manga Status Colors",
      description: "Use fixed colors for manga status distribution",
      checked: useMangaStatusColors,
      onChange: handleToggleMangaStatusColors,
      color: "purple",
    },
  ];

  const chartOptions = [
    {
      id: "pie-percentages",
      icon: Percent,
      label: "Pie Percentages",
      description: "Display percentage values in chart legends",
      checked: showPiePercentages,
      onChange: handleToggleShowPiePercentages,
      color: "emerald",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-md shadow-slate-800/25">
          <Settings2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Advanced Options
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Fine-tune your card appearance
          </p>
        </div>
      </div>

      {/* Options Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <OptionListGroup
          title="Status Colors"
          Icon={Palette}
          items={statusColorOptions}
          headerGradientClasses="bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-orange-500/25"
          groupDelay={0}
          itemDelayStart={0}
        />

        <OptionListGroup
          title="Chart Options"
          Icon={PieChart}
          items={chartOptions}
          headerGradientClasses="bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/25"
          groupDelay={0.1}
          itemDelayStart={0.1}
        />
      </div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
        className="rounded-2xl border border-blue-200/50 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50/30 p-4 shadow-sm dark:border-blue-800/30 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/10"
      >
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-md shadow-blue-500/25">
            <Info className="h-4 w-4 text-white" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Status Color Guide
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { status: "Current", color: "bg-green-500", emoji: "🟢" },
                { status: "Paused", color: "bg-yellow-500", emoji: "🟡" },
                { status: "Completed", color: "bg-blue-500", emoji: "🔵" },
                { status: "Dropped", color: "bg-red-500", emoji: "🔴" },
                { status: "Planning", color: "bg-gray-400", emoji: "⚪" },
              ].map((item) => (
                <span
                  key={item.status}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-300"
                >
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", item.color)}
                  />
                  {item.status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Memoized version of AdvancedOptions that prevents unnecessary re-renders
 * when the context values for status colors and pie percentages haven't changed.
 */
export const AdvancedOptions = React.memo(AdvancedOptionsComponent);
