"use client";

import React from "react";

export type HighlightItem = Readonly<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  bgLight?: string;
  textColor?: string;
}>;

export default function HeroHighlights({
  items,
  className = "mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3",
}: Readonly<{ items: HighlightItem[]; className?: string }>) {
  return (
    <div className={className}>
      {items.map((highlight) => (
        <div
          key={highlight.title}
          className="flex flex-col items-center rounded-2xl border border-slate-200/50 bg-white/80 p-5 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80"
        >
          <div
            className={`mb-3 rounded-xl p-2.5 ${highlight.bgLight ?? "bg-blue-100 dark:bg-blue-900/30"}`}
          >
            <highlight.icon
              className={`h-5 w-5 ${highlight.textColor ?? "text-blue-600 dark:text-blue-400"}`}
            />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">
            {highlight.title}
          </h3>
          <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
            {highlight.description}
          </p>
        </div>
      ))}
    </div>
  );
}
