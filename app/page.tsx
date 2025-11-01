/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  BarChart2,
  Users,
  BookOpen,
  Mic,
  Building2,
  Sparkles,
  Zap,
  Heart,
  Download,
  Share2,
  Play,
  ArrowDown,
  ArrowRight,
} from "lucide-react";
import { StatCardGenerator } from "@/components/stat-card-generator";
import { motion } from "framer-motion";
import type React from "react";
import {
  trackButtonClick,
  trackDialogOpen,
} from "@/lib/utils/google-analytics";

// Color mapping to avoid dynamic Tailwind class generation
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/20",
    text: "text-green-600 dark:text-green-400",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/20",
    text: "text-purple-600 dark:text-purple-400",
  },
  pink: {
    bg: "bg-pink-100 dark:bg-pink-900/20",
    text: "text-pink-600 dark:text-pink-400",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/20",
    text: "text-orange-600 dark:text-orange-400",
  },
  indigo: {
    bg: "bg-indigo-100 dark:bg-indigo-900/20",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900/20",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
  },
  cyan: {
    bg: "bg-cyan-100 dark:bg-cyan-900/20",
    text: "text-cyan-600 dark:text-cyan-400",
  },
};

// Image component with skeleton loading
type ImageWithSkeletonProps = {
  src: string;
  alt: string;
  className: string;
  style?: React.CSSProperties;
};

const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className,
  style,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Fallback timeout to show content even if onLoad doesn't fire
    const fallbackTimer = setTimeout(() => {
      if (!isLoaded && !hasError) {
        setIsLoaded(true);
      }
    }, 2000);

    return () => clearTimeout(fallbackTimer);
  }, [isLoaded, hasError]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div className="relative h-full w-full">
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        style={style}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
          <span className="text-sm text-gray-500">Failed to load</span>
        </div>
      )}
    </div>
  );
};

export default function HomePage() {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const handleGetStartedClick = () => {
    trackButtonClick("get_started", "homepage");
    trackDialogOpen("stat_card_generator");
    setIsGeneratorOpen(true);
  };

  return (
    <div className="overflow-hidden">
      {/* Hero Section with Sample Cards */}
      <section className="relative min-h-[80vh] w-full bg-gradient-to-b from-blue-50 via-indigo-50 to-blue-50/30 dark:from-slate-900 dark:via-blue-950 dark:to-gray-900/80">
        {/* Background Pattern */}
        <div className="bg-grid-slate-100 dark:bg-grid-slate-700/25 absolute inset-0 h-full w-full bg-[size:60px_60px] opacity-30" />

        <div className="container relative mx-auto px-4 py-16">
          <div className="mx-auto max-w-6xl">
            {/* Main Hero Content */}
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left Content */}
              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6"
                >
                  <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-medium">
                      Transform Your AniList Data
                    </span>
                  </div>

                  <h1 className="text-4xl font-bold leading-tight text-gray-900 dark:text-white lg:text-6xl">
                    Create stunning{" "}
                    <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      anime & manga
                    </span>{" "}
                    stat cards
                  </h1>

                  <p className="text-lg text-gray-600 dark:text-gray-300 lg:text-xl">
                    Generate beautiful, shareable visualizations of your AniList
                    statistics. Choose from 10+ card types, customize colors,
                    and showcase your journey.
                  </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
                >
                  <Button
                    size="lg"
                    onClick={handleGetStartedClick}
                    className="group transform-gpu bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-base font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Create Your Cards
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 px-8 py-4 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      trackButtonClick("see_examples", "homepage");
                      document
                        .getElementById("preview-showcase")
                        ?.scrollIntoView({
                          behavior: "smooth",
                        });
                    }}
                  >
                    <ArrowDown className="mr-2 h-5 w-5" />
                    See Examples
                  </Button>
                </motion.div>

                {/* Quick Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="grid grid-cols-3 gap-6 pt-6"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      10+
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Card Types
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                      24/7
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Auto Updates
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Right Content - Sample Cards */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                {/* Floating Sample Cards */}
                <div className="relative h-[500px] w-full">
                  {/* Main Card - Anime Stats PNG */}
                  <motion.div
                    className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transform"
                    animate={{
                      y: [0, -10, 0],
                      rotate: [0, 1, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <div
                      className="overflow-hidden rounded-lg shadow-2xl"
                      style={{ width: "450px", height: "195px" }}
                    >
                      <ImageWithSkeleton
                        src="https://anicards.alpha49.com/api/card.svg?cardType=animeStats&userId=542244&variation=default"
                        alt="Example Anime Statistics Card"
                        className="h-full w-full object-contain"
                        style={{ borderRadius: "8px" }}
                      />
                    </div>
                  </motion.div>

                  {/* Background Cards */}
                  <motion.div
                    className="absolute left-8 top-16 z-10 rotate-[-8deg] transform"
                    animate={{
                      y: [0, -5, 0],
                      rotate: [-8, -6, -8],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: 0.5,
                      ease: "easeInOut",
                    }}
                  >
                    <div
                      className="overflow-hidden rounded-lg opacity-80 shadow-xl"
                      style={{ width: "340px", height: "200px" }}
                    >
                      <ImageWithSkeleton
                        src="https://anicards.alpha49.com/api/card.svg?cardType=animeGenres&userId=542244&variation=pie"
                        alt="Example Genre Distribution Card"
                        className="h-full w-full object-contain"
                        style={{ borderRadius: "8px" }}
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    className="absolute bottom-16 right-8 z-10 rotate-[12deg] transform"
                    animate={{
                      y: [0, -8, 0],
                      rotate: [12, 14, 12],
                    }}
                    transition={{
                      duration: 3.5,
                      repeat: Infinity,
                      delay: 1,
                      ease: "easeInOut",
                    }}
                  >
                    <div
                      className="overflow-hidden rounded-lg opacity-80 shadow-xl"
                      style={{ width: "280px", height: "195px" }}
                    >
                      <ImageWithSkeleton
                        src="https://anicards.alpha49.com/api/card.svg?cardType=socialStats&userId=542244&variation=default"
                        alt="Example Social Activity Card"
                        className="h-full w-full object-contain"
                        style={{ borderRadius: "8px" }}
                      />
                    </div>
                  </motion.div>
                </div>

                {/* Floating Elements */}
                <motion.div
                  className="absolute -top-4 right-16 text-blue-500"
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: 2,
                  }}
                >
                  <Sparkles className="h-6 w-6" />
                </motion.div>

                <motion.div
                  className="absolute -bottom-8 left-12 text-purple-500"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Zap className="h-8 w-8" />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transform text-gray-400"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ArrowDown className="h-6 w-6" />
        </motion.div>
      </section>

      {/* Interactive Preview Showcase */}
      <section
        id="preview-showcase"
        className="relative w-full bg-gradient-to-b from-blue-50/30 via-white to-gray-50/50 py-20 dark:from-gray-900/80 dark:via-gray-900 dark:to-gray-800"
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
                Choose from{" "}
                <span className="text-blue-600">20+ Card Types & Variants</span>
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
                From basic stats to detailed breakdowns - visualize every aspect
                of your anime and manga journey with multiple layout options
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                ✨ All examples show live AniCards data from user{" "}
                <a
                  href="https://anilist.co/user/Alpha49"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-200 hover:text-blue-900 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/70 dark:hover:text-white"
                  aria-label="View Alpha49's AniList profile"
                >
                  @Alpha49
                </a>{" "}
                •
                <Link
                  href="/examples"
                  className="ml-1 font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View all card types & variants →
                </Link>
              </div>
            </motion.div>

            {/* Card Gallery - Grid Layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(() => {
                const BASE_URL = "https://anicards.alpha49.com/api/card.svg";
                const USER_ID = "542244";

                return [
                  {
                    title: "Anime Statistics",
                    description:
                      "Complete overview of your anime watching journey",
                    apiUrl: `${BASE_URL}?cardType=animeStats&userId=${USER_ID}&variation=default`,
                    category: "Main Stats",
                    color: "blue",
                  },
                  {
                    title: "Social Activity",
                    description: "Community engagement and social metrics",
                    apiUrl: `${BASE_URL}?cardType=socialStats&userId=${USER_ID}&variation=default`,
                    category: "Social",
                    color: "green",
                  },
                  {
                    title: "Genre Distribution",
                    description: "Beautiful pie chart of your favorite genres",
                    apiUrl: `${BASE_URL}?cardType=animeGenres&userId=${USER_ID}&variation=pie`,
                    category: "Analysis",
                    color: "purple",
                  },
                  {
                    title: "Manga Statistics",
                    description: "Comprehensive manga reading statistics",
                    apiUrl: `${BASE_URL}?cardType=mangaStats&userId=${USER_ID}&variation=default`,
                    category: "Main Stats",
                    color: "pink",
                  },
                  {
                    title: "Voice Actors",
                    description: "Most frequent voice actors in your anime",
                    apiUrl: `${BASE_URL}?cardType=animeVoiceActors&userId=${USER_ID}&variation=default`,
                    category: "Deep Dive",
                    color: "orange",
                  },
                  {
                    title: "Score Distribution",
                    description: "How you rate anime with detailed charts",
                    apiUrl: `${BASE_URL}?cardType=animeScoreDistribution&userId=${USER_ID}&variation=default`,
                    category: "Analysis",
                    color: "indigo",
                  },
                  {
                    title: "Anime Studios",
                    description: "Your favorite animation studios",
                    apiUrl: `${BASE_URL}?cardType=animeStudios&userId=${USER_ID}&variation=default`,
                    category: "Deep Dive",
                    color: "teal",
                  },
                  {
                    title: "Manga Genres",
                    description: "Manga genre preferences breakdown",
                    apiUrl: `${BASE_URL}?cardType=mangaGenres&userId=${USER_ID}&variation=pie`,
                    category: "Analysis",
                    color: "violet",
                  },
                ];
              })().map((cardType, index) => (
                <motion.div
                  key={cardType.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="group cursor-pointer"
                >
                  <Card className="h-full transform-gpu overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:border-blue-300 hover:shadow-xl dark:hover:border-blue-700">
                    <CardContent className="flex h-full flex-col p-0">
                      {/* Live API SVG Display */}
                      <div className="relative flex flex-1 items-center justify-center p-6">
                        <ImageWithSkeleton
                          src={cardType.apiUrl}
                          alt={`${cardType.title} Live Example`}
                          className="h-auto w-full max-w-full rounded-lg object-contain"
                          style={{
                            maxHeight: "200px",
                          }}
                        />
                      </div>

                      {/* Card Info */}
                      <div className="mt-auto p-4">
                        <div className="mb-2">
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {cardType.title}
                          </h3>
                        </div>
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                          {cardType.description}
                        </p>

                        {/* Action Footer */}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="text-xs text-gray-500">
                              Live Data
                            </span>
                          </div>
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            {cardType.category}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Interactive Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-16 text-center"
            >
              <div className="mx-auto mb-12 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
                <div className="flex flex-col items-center space-y-3">
                  <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                    <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Multiple Variations
                  </h3>
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Each card type offers different layouts and styling options
                    to match your preferences
                  </p>
                </div>
                <div className="flex flex-col items-center space-y-3">
                  <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                    <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Real-Time Updates
                  </h3>
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Your cards automatically sync with AniList to always show
                    your latest statistics
                  </p>
                </div>
                <div className="flex flex-col items-center space-y-3">
                  <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
                    <Heart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Fully Customizable
                  </h3>
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Choose colors, themes, and layouts that perfectly represent
                    your unique style
                  </p>
                </div>
              </div>

              <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 p-8 dark:from-blue-900/20 dark:to-purple-900/20">
                <p className="mb-4 text-gray-600 dark:text-gray-400">
                  <strong>Ready to see your own data?</strong> These are live
                  examples using real AniList data - create your personalized
                  cards with your actual statistics!
                </p>
              </div>

              <div className="flex flex-col items-center space-y-4 sm:flex-row sm:justify-center sm:space-x-6 sm:space-y-0">
                <Button
                  size="lg"
                  onClick={handleGetStartedClick}
                  className="transform-gpu bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Create Your Live Cards
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <Link href="/examples">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 px-8 py-4 text-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <BarChart2 className="mr-2 h-5 w-5" />
                    View All Examples
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section className="relative w-full bg-gradient-to-b from-gray-50/50 via-blue-50/40 to-purple-100/30 py-20 dark:from-gray-800 dark:via-blue-900/30 dark:to-purple-900/20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
                Everything you need to{" "}
                <span className="text-blue-600">visualize your journey</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
                Powerful features designed to showcase your anime and manga
                passion in the most beautiful way
              </p>
            </motion.div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: BarChart2,
                  title: "Comprehensive Stats",
                  description:
                    "View detailed statistics about your anime and manga, including watch time, episode count, etc.",
                  color: "blue",
                },
                {
                  icon: Users,
                  title: "Social Insights",
                  description:
                    "Track your Anilist social activity, including followers, following, and engagement metrics.",
                  color: "green",
                },
                {
                  icon: BookOpen,
                  title: "Manga Analysis",
                  description:
                    "Dive deep into your manga reading habits with chapter and volume counts, mean scores, etc.",
                  color: "purple",
                },
                {
                  icon: Heart,
                  title: "Genre & Tag Breakdown",
                  description:
                    "Discover your top anime and manga genres and tags to understand your preferences better",
                  color: "pink",
                },
                {
                  icon: Mic,
                  title: "Voice Actor Spotlight",
                  description:
                    "Identify the voice actors who appear most frequently in your anime collection.",
                  color: "orange",
                },
                {
                  icon: Building2,
                  title: "Studio Insights",
                  description:
                    "See which animation studios produce your most-watched content.",
                  color: "indigo",
                },
                {
                  icon: Zap,
                  title: "Daily Updates",
                  description:
                    "Your statistics automatically refresh daily to keep your cards current and accurate.",
                  color: "yellow",
                },
                {
                  icon: Sparkles,
                  title: "Custom Themes",
                  description:
                    "Choose from beautiful presets or create your own color schemes to match your style.",
                  color: "violet",
                },
                {
                  icon: Share2,
                  title: "Easy Sharing",
                  description:
                    "Generate optimized SVG cards that work perfectly across all social media platforms.",
                  color: "cyan",
                },
              ].map((feature, index) => {
                const colors = COLOR_MAP[feature.color] || COLOR_MAP.blue;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="group"
                  >
                    <Card className="h-full overflow-hidden border-0 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                      <CardContent className="p-8">
                        <motion.div
                          className={`inline-flex rounded-xl p-3 ${colors.bg} mb-6`}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ duration: 0.2 }}
                        >
                          <feature.icon className={`h-8 w-8 ${colors.text}`} />
                        </motion.div>

                        <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
                          {feature.title}
                        </h3>

                        <p className="mb-6 text-gray-600 dark:text-gray-300">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative w-full overflow-hidden bg-gradient-to-b from-purple-100/30 py-20 text-white dark:from-purple-900/20">
        {/* Background Pattern */}
        <div className="absolute inset-0 h-full w-full opacity-10">
          <div className="bg-grid-white absolute inset-0 h-full w-full bg-[size:30px_30px]" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="space-y-6">
                <motion.div
                  className="inline-flex items-center space-x-2 rounded-full bg-gray-300/30 px-4 py-2 backdrop-blur-sm dark:bg-white/10"
                  whileHover={{ scale: 1.05 }}
                >
                  <Sparkles className="h-4 w-4 text-gray-900 dark:text-white" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Ready to get started?
                  </span>
                </motion.div>

                <h2 className="text-4xl font-bold leading-tight text-gray-900 dark:text-white lg:text-5xl">
                  Transform your AniList data into{" "}
                  <span className="mt-2 block">stunning visual stories</span>
                </h2>

                <p className="mx-auto max-w-2xl text-lg text-gray-900 opacity-90 dark:text-white lg:text-xl">
                  Join the community of anime fans showcasing their journey.
                  Create your first card in seconds, completely free.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-6 sm:flex-row sm:justify-center sm:space-x-6 sm:space-y-0">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    size="lg"
                    onClick={handleGetStartedClick}
                    className="hover:shadow-3xl transform-gpu bg-white px-10 py-4 text-lg font-semibold text-blue-600 shadow-2xl transition-all duration-300 hover:bg-gray-50"
                  >
                    <Play className="mr-3 h-6 w-6" />
                    Create Your First Card
                    <ArrowRight className="ml-3 h-6 w-6" />
                  </Button>
                </motion.div>
              </div>

              {/* Floating Action Elements */}
              <div className="relative mt-16">
                <motion.div
                  className="absolute -left-16 -top-8 hidden lg:block"
                  animate={{
                    rotate: [0, 10, 0],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                    <Download className="h-6 w-6" />
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -right-16 -top-8 hidden lg:block"
                  animate={{
                    rotate: [0, -10, 0],
                    y: [0, -15, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: 1,
                    ease: "easeInOut",
                  }}
                >
                  <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                    <Share2 className="h-6 w-6" />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stat card generator modal/dialog */}
      <StatCardGenerator
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        className={`transition-opacity duration-300 ${
          isGeneratorOpen ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
