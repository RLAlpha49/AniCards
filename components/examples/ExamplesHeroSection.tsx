"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  PieChart,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  stats: {
    mainStats: number;
    profileFavourites: number;
    completionProgress: number;
    comparisons: number;
    animeBreakdowns: number;
    mangaBreakdowns: number;
    totalVariants: number;
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const STAT_CATEGORIES = [
  {
    key: "mainStats",
    label: "Main Stats",
    icon: BarChart2,
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "profileFavourites",
    label: "Profile & Favourites",
    icon: Sparkles,
    bg: "bg-teal-100 dark:bg-teal-900/30",
    text: "text-teal-600 dark:text-teal-400",
  },
  {
    key: "completionProgress",
    label: "Completion & Progress",
    icon: TrendingUp,
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "comparisons",
    label: "Comparisons",
    icon: PieChart,
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "animeBreakdowns",
    label: "Anime Breakdowns",
    icon: PieChart,
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
  },
  {
    key: "mangaBreakdowns",
    label: "Manga Breakdowns",
    icon: BookOpen,
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-600 dark:text-pink-400",
  },
  {
    key: "totalVariants",
    label: "Total Variants",
    icon: TrendingUp,
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-600 dark:text-green-400",
  },
] as const;

export function ExamplesHeroSection({
  searchQuery,
  onSearchChange,
  stats,
}: Readonly<HeroSectionProps>) {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 py-16 lg:py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-6xl"
        >
          <motion.div
            variants={itemVariants}
            className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
          >
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="group text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Home
              </Button>
            </Link>
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-11 rounded-full border-slate-200 bg-white/80 pl-10 dark:border-slate-700 dark:bg-slate-800/80"
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-200/50 bg-purple-50/80 px-4 py-2 text-sm font-medium text-purple-700 shadow-sm backdrop-blur-sm dark:border-purple-700/50 dark:bg-purple-950/50 dark:text-purple-300">
              <Sparkles className="h-4 w-4" />
              Card Gallery
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl"
          >
            Explore All{" "}
            <span className="relative">
              <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Card Types
              </span>
              <motion.span
                className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto mb-12 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
          >
            Browse the complete collection of statistical visualizations. All
            examples are generated in real-time using data from{" "}
            <a
              href="https://anilist.co/user/Alpha49"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              @Alpha49
            </a>
            {""}.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          >
            {STAT_CATEGORIES.map((stat) => {
              const Icon = stat.icon;
              const value = stats[stat.key];
              return (
                <motion.div
                  key={stat.key}
                  whileHover={{ scale: 1.02 }}
                  className="group rounded-2xl border border-slate-200/50 bg-white/80 p-5 backdrop-blur-sm transition-all hover:border-slate-300/50 hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:border-slate-600/50"
                >
                  <div
                    className={`mb-3 inline-flex rounded-xl p-2.5 ${stat.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${stat.text}`} />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {value}
                  </div>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
