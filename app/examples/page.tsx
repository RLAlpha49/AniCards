/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BarChart2,
  Users,
  PieChart,
  TrendingUp,
  Mic,
  Building2,
  BookOpen,
  Play,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { usePageSEO } from "@/hooks/use-page-seo";

interface CardVariant {
  name: string;
  url: string;
  description?: string;
}

interface CardType {
  title: string;
  description: string;
  variants: CardVariant[];
  category: "Main Stats" | "Anime Breakdowns" | "Manga Breakdowns";
  icon: React.ElementType;
  color: string;
}

export function CardWithSkeleton({
  variant,
  cardTypeTitle,
  userId,
}: Readonly<{
  variant: CardVariant;
  cardTypeTitle: string;
  userId: string;
}>) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Fallback timeout to show content even if onLoad doesn't fire
    const fallbackTimer = setTimeout(() => {
      if (!isLoaded && !hasError) {
        setIsLoaded(true);
      }
    }, 0); // 3 second fallback

    return () => clearTimeout(fallbackTimer);
  }, [isLoaded, hasError]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <Card className="group transform-gpu overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
      <CardContent className="p-4">
        {(() => {
          let content;
          if (!isLoaded && !hasError) {
            // Skeleton state
            content = (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-4" />
                </div>
                <Skeleton className="h-32 w-full rounded-lg" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            );
          } else if (hasError) {
            // Error state
            content = (
              <div className="space-y-3">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {variant.name}
                  </h4>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex h-32 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                  <span className="text-sm text-gray-500">Failed to load</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Live API Example</span>
                    <span>User: {userId}</span>
                  </div>
                </div>
              </div>
            );
          } else {
            // Loaded state
            content = (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {variant.name}
                  </h4>
                  <a
                    href={variant.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <ExternalLink className="h-4 w-4 text-gray-400 hover:text-blue-600" />
                  </a>
                </div>

                <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                  <img
                    src={variant.url}
                    alt={`${cardTypeTitle} - ${variant.name}`}
                    className="w-full object-contain transition-opacity duration-300"
                    loading="lazy"
                    onLoad={handleLoad}
                    onError={handleError}
                  />
                </div>

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Live API Example</span>
                    <span>User: {userId}</span>
                  </div>
                </div>
              </>
            );
          }
          return content;
        })()}

        {/* Hidden img to trigger loading detection */}
        {!isLoaded && !hasError && (
          <img
            src={variant.url}
            alt={`${cardTypeTitle} - ${variant.name}`}
            className="hidden"
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function ExamplesPage() {
  usePageSEO("examples");

  const BASE_URL = "https://anicards.alpha49.com/api/card.svg";
  const USER_ID = "542244";

  const cardTypes: CardType[] = [
    // Main Stats
    {
      title: "Anime Statistics",
      description:
        "Complete overview of your anime watching journey with various layout options",
      category: "Main Stats",
      icon: BarChart2,
      color: "blue",
      variants: [
        {
          name: "Vertical",
          url: `${BASE_URL}?cardType=animeStats&userId=${USER_ID}&variation=vertical`,
        },
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeStats&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Compact",
          url: `${BASE_URL}?cardType=animeStats&userId=${USER_ID}&variation=compact`,
        },
        {
          name: "Minimal",
          url: `${BASE_URL}?cardType=animeStats&userId=${USER_ID}&variation=minimal`,
        },
      ],
    },
    {
      title: "Manga Statistics",
      description:
        "Comprehensive manga reading statistics with different display formats",
      category: "Main Stats",
      icon: BookOpen,
      color: "pink",
      variants: [
        {
          name: "Vertical",
          url: `${BASE_URL}?cardType=mangaStats&userId=${USER_ID}&variation=vertical`,
        },
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaStats&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Compact",
          url: `${BASE_URL}?cardType=mangaStats&userId=${USER_ID}&variation=compact`,
        },
        {
          name: "Minimal",
          url: `${BASE_URL}?cardType=mangaStats&userId=${USER_ID}&variation=minimal`,
        },
      ],
    },
    {
      title: "Social Statistics",
      description: "Community engagement metrics and social activity overview",
      category: "Main Stats",
      icon: Users,
      color: "green",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=socialStats&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Compact",
          url: `${BASE_URL}?cardType=socialStats&userId=${USER_ID}&variation=compact`,
        },
        {
          name: "Minimal",
          url: `${BASE_URL}?cardType=socialStats&userId=${USER_ID}&variation=minimal`,
        },
      ],
    },

    // Anime Breakdowns
    {
      title: "Anime Genres",
      description:
        "Breakdown of your anime genre preferences with multiple visualization options",
      category: "Anime Breakdowns",
      icon: PieChart,
      color: "purple",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeGenres&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeGenres&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeGenres&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Anime Tags",
      description: "Most common tags from your anime collection",
      category: "Anime Breakdowns",
      icon: PieChart,
      color: "indigo",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeTags&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeTags&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeTags&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Voice Actors",
      description: "Most frequent voice actors in your anime collection",
      category: "Anime Breakdowns",
      icon: Mic,
      color: "orange",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeVoiceActors&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeVoiceActors&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeVoiceActors&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Animation Studios",
      description: "Your favorite animation studios breakdown",
      category: "Anime Breakdowns",
      icon: Building2,
      color: "teal",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeStudios&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeStudios&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeStudios&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Anime Staff",
      description: "Most frequent staff members in your anime collection",
      category: "Anime Breakdowns",
      icon: Users,
      color: "cyan",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeStaff&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeStaff&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeStaff&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Anime Status Distribution",
      description:
        "Distribution of anime by watching status with optional status colors",
      category: "Anime Breakdowns",
      icon: TrendingUp,
      color: "emerald",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeStatusDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeStatusDistribution&userId=${USER_ID}&variation=pie&statusColors=true`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeStatusDistribution&userId=${USER_ID}&variation=bar&statusColors=true`,
        },
      ],
    },
    {
      title: "Anime Format Distribution",
      description: "Breakdown by anime formats (TV, Movie, OVA, etc.)",
      category: "Anime Breakdowns",
      icon: PieChart,
      color: "violet",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeFormatDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeFormatDistribution&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeFormatDistribution&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Anime Country Distribution",
      description: "Anime by country of origin breakdown",
      category: "Anime Breakdowns",
      icon: PieChart,
      color: "rose",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeCountry&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=animeCountry&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=animeCountry&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Anime Score Distribution",
      description: "Distribution of your anime ratings",
      category: "Anime Breakdowns",
      icon: TrendingUp,
      color: "amber",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeScoreDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Horizontal",
          url: `${BASE_URL}?cardType=animeScoreDistribution&userId=${USER_ID}&variation=horizontal`,
        },
      ],
    },
    {
      title: "Anime Year Distribution",
      description: "Distribution of anime by release year",
      category: "Anime Breakdowns",
      icon: TrendingUp,
      color: "lime",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=animeYearDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Horizontal",
          url: `${BASE_URL}?cardType=animeYearDistribution&userId=${USER_ID}&variation=horizontal`,
        },
      ],
    },

    // Manga Breakdowns
    {
      title: "Manga Genres",
      description: "Breakdown of your manga genre preferences",
      category: "Manga Breakdowns",
      icon: PieChart,
      color: "purple",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaGenres&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=mangaGenres&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=mangaGenres&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Manga Tags",
      description: "Most common tags from your manga collection",
      category: "Manga Breakdowns",
      icon: PieChart,
      color: "indigo",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaTags&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=mangaTags&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=mangaTags&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Manga Staff",
      description: "Most frequent staff members in your manga collection",
      category: "Manga Breakdowns",
      icon: Users,
      color: "cyan",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaStaff&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=mangaStaff&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=mangaStaff&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Manga Status Distribution",
      description: "Distribution of manga by reading status",
      category: "Manga Breakdowns",
      icon: TrendingUp,
      color: "emerald",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaStatusDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=mangaStatusDistribution&userId=${USER_ID}&variation=pie&statusColors=true`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=mangaStatusDistribution&userId=${USER_ID}&variation=bar&statusColors=true`,
        },
      ],
    },
    {
      title: "Manga Format Distribution",
      description: "Breakdown by manga formats (Manga, Novel, etc.)",
      category: "Manga Breakdowns",
      icon: PieChart,
      color: "violet",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaFormatDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=mangaFormatDistribution&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=mangaFormatDistribution&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Manga Country Distribution",
      description: "Manga by country of origin breakdown",
      category: "Manga Breakdowns",
      icon: PieChart,
      color: "rose",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaCountry&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Pie Chart",
          url: `${BASE_URL}?cardType=mangaCountry&userId=${USER_ID}&variation=pie`,
        },
        {
          name: "Bar Chart",
          url: `${BASE_URL}?cardType=mangaCountry&userId=${USER_ID}&variation=bar`,
        },
      ],
    },
    {
      title: "Manga Score Distribution",
      description: "Distribution of your manga ratings",
      category: "Manga Breakdowns",
      icon: TrendingUp,
      color: "amber",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaScoreDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Horizontal",
          url: `${BASE_URL}?cardType=mangaScoreDistribution&userId=${USER_ID}&variation=horizontal`,
        },
      ],
    },
    {
      title: "Manga Year Distribution",
      description: "Distribution of manga by release year",
      category: "Manga Breakdowns",
      icon: TrendingUp,
      color: "lime",
      variants: [
        {
          name: "Default",
          url: `${BASE_URL}?cardType=mangaYearDistribution&userId=${USER_ID}&variation=default`,
        },
        {
          name: "Horizontal",
          url: `${BASE_URL}?cardType=mangaYearDistribution&userId=${USER_ID}&variation=horizontal`,
        },
      ],
    },
  ];

  const categories = [
    "Main Stats",
    "Anime Breakdowns",
    "Manga Breakdowns",
  ] as const;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Main Stats":
        return BarChart2;
      case "Anime Breakdowns":
        return PieChart;
      case "Manga Breakdowns":
        return BookOpen;
      default:
        return BarChart2;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Anime Breakdowns":
        return {
          bg: "bg-purple-100 dark:bg-purple-900/30",
          text: "text-purple-600 dark:text-purple-400",
        };
      case "Manga Breakdowns":
        return {
          bg: "bg-pink-100 dark:bg-pink-900/30",
          text: "text-pink-600 dark:text-pink-400",
        };
      case "Main Stats":
      default:
        return {
          bg: "bg-blue-100 dark:bg-blue-900/30",
          text: "text-blue-600 dark:text-blue-400",
        };
    }
  };

  const getCardTypeColor = (color: string) => {
    switch (color) {
      case "blue":
        return {
          bg: "bg-blue-100 dark:bg-blue-900/30",
          text: "text-blue-600 dark:text-blue-400",
        };
      case "pink":
        return {
          bg: "bg-pink-100 dark:bg-pink-900/30",
          text: "text-pink-600 dark:text-pink-400",
        };
      case "green":
        return {
          bg: "bg-green-100 dark:bg-green-900/30",
          text: "text-green-600 dark:text-green-400",
        };
      case "purple":
        return {
          bg: "bg-purple-100 dark:bg-purple-900/30",
          text: "text-purple-600 dark:text-purple-400",
        };
      case "indigo":
        return {
          bg: "bg-indigo-100 dark:bg-indigo-900/30",
          text: "text-indigo-600 dark:text-indigo-400",
        };
      case "orange":
        return {
          bg: "bg-orange-100 dark:bg-orange-900/30",
          text: "text-orange-600 dark:text-orange-400",
        };
      case "teal":
        return {
          bg: "bg-teal-100 dark:bg-teal-900/30",
          text: "text-teal-600 dark:text-teal-400",
        };
      case "cyan":
        return {
          bg: "bg-cyan-100 dark:bg-cyan-900/30",
          text: "text-cyan-600 dark:text-cyan-400",
        };
      case "emerald":
        return {
          bg: "bg-emerald-100 dark:bg-emerald-900/30",
          text: "text-emerald-600 dark:text-emerald-400",
        };
      case "violet":
        return {
          bg: "bg-violet-100 dark:bg-violet-900/30",
          text: "text-violet-600 dark:text-violet-400",
        };
      case "rose":
        return {
          bg: "bg-rose-100 dark:bg-rose-900/30",
          text: "text-rose-600 dark:text-rose-400",
        };
      case "amber":
        return {
          bg: "bg-amber-100 dark:bg-amber-900/30",
          text: "text-amber-600 dark:text-amber-400",
        };
      case "lime":
        return {
          bg: "bg-lime-100 dark:bg-lime-900/30",
          text: "text-lime-600 dark:text-lime-400",
        };
      default:
        return {
          bg: "bg-gray-100 dark:bg-gray-900/30",
          text: "text-gray-600 dark:text-gray-400",
        };
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-white to-gray-50 dark:from-slate-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header Section */}
      <section className="relative border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* Navigation */}
              <div className="flex items-center space-x-4">
                <Link href="/">
                  <Button variant="outline" size="sm" className="group">
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Back to Home
                  </Button>
                </Link>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  All Card Examples
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white lg:text-5xl">
                  All Card Types & Variants
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 lg:text-xl">
                  Explore every available card type with live examples from{" "}
                  <a
                    href="https://anilist.co/user/Alpha49"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-base font-semibold text-blue-700 transition-colors hover:bg-blue-200 hover:text-blue-900 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/70 dark:hover:text-white"
                    aria-label="View Alpha49's AniList profile"
                  >
                    @Alpha49
                  </a>{" "}
                  . All cards are generated in real-time using the AniCards API.
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {categories.map((category) => {
                  const count = cardTypes.filter(
                    (card) => card.category === category,
                  ).length;
                  const Icon = getCategoryIcon(category);
                  const colors = getCategoryColor(category);

                  return (
                    <div key={category} className="text-center">
                      <div
                        className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${colors.bg}`}
                      >
                        <Icon className={`h-6 w-6 ${colors.text}`} />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {count}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {category}
                      </div>
                    </div>
                  );
                })}
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {cardTypes.reduce(
                      (total, card) => total + card.variants.length,
                      0,
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Variants
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Card Showcase by Category */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-7xl space-y-16">
            {categories.map((category, categoryIndex) => {
              const categoryCards = cardTypes.filter(
                (card) => card.category === category,
              );
              const CategoryIcon = getCategoryIcon(category);
              const categoryColors = getCategoryColor(category);

              // Special handling for Main Stats (first category) to ensure it always loads
              const isFirstCategory = categoryIndex === 0;

              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isFirstCategory ? { opacity: 1, y: 0 } : undefined}
                  whileInView={
                    !isFirstCategory ? { opacity: 1, y: 0 } : undefined
                  }
                  transition={{
                    duration: 0.6,
                    delay: isFirstCategory ? 0.3 : categoryIndex * 0.1,
                  }}
                  viewport={
                    !isFirstCategory
                      ? {
                          once: true,
                          margin: "-10% 0px -10% 0px",
                          amount: 0.1,
                        }
                      : undefined
                  }
                  className="space-y-8"
                >
                  {/* Category Header */}
                  <div className="border-l-4 border-blue-500 pl-6">
                    <div className="flex items-center space-x-3">
                      <div className={`rounded-lg ${categoryColors.bg} p-2`}>
                        <CategoryIcon
                          className={`h-6 w-6 ${categoryColors.text}`}
                        />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">
                          {category}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                          {categoryCards.length} card type
                          {categoryCards.length !== 1 ? "s" : ""} with{" "}
                          {categoryCards.reduce(
                            (total, card) => total + card.variants.length,
                            0,
                          )}{" "}
                          total variants
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cards for this Category */}
                  <div className="space-y-12">
                    {categoryCards.map((cardType, cardIndex) => (
                      <motion.div
                        key={cardType.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={
                          isFirstCategory ? { opacity: 1, y: 0 } : undefined
                        }
                        whileInView={
                          !isFirstCategory ? { opacity: 1, y: 0 } : undefined
                        }
                        transition={{
                          duration: 0.6,
                          delay: isFirstCategory
                            ? 0.5 + cardIndex * 0.1
                            : cardIndex * 0.1,
                        }}
                        viewport={!isFirstCategory ? { once: true } : undefined}
                        className="space-y-6"
                      >
                        {/* Card Type Header */}
                        <div className="flex items-center space-x-3">
                          <div
                            className={`rounded-lg ${getCardTypeColor(cardType.color).bg} p-2`}
                          >
                            <cardType.icon
                              className={`h-5 w-5 ${getCardTypeColor(cardType.color).text}`}
                            />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {cardType.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {cardType.description}
                            </p>
                          </div>
                        </div>

                        {/* Variants Grid */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {cardType.variants.map((variant, variantIndex) => (
                            <motion.div
                              key={variant.name}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={
                                isFirstCategory
                                  ? { opacity: 1, scale: 1 }
                                  : undefined
                              }
                              whileInView={
                                !isFirstCategory
                                  ? { opacity: 1, scale: 1 }
                                  : undefined
                              }
                              transition={{
                                duration: 0.4,
                                delay: isFirstCategory
                                  ? 0.7 + cardIndex * 0.1 + variantIndex * 0.05
                                  : variantIndex * 0.05,
                              }}
                              viewport={
                                !isFirstCategory ? { once: true } : undefined
                              }
                            >
                              <CardWithSkeleton
                                variant={variant}
                                cardTypeTitle={cardType.title}
                                userId={USER_ID}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="border-t border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 py-16 dark:border-gray-700 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl space-y-8 text-center"
          >
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
                Ready to create your own?
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
                These are live examples using real AniList data from user{" "}
                {USER_ID}. Generate your personalized cards with your own
                AniList statistics!
              </p>
            </div>

            <div className="flex flex-col items-center space-y-4 sm:flex-row sm:justify-center sm:space-x-6 sm:space-y-0">
              <Link href="/">
                <Button
                  size="lg"
                  className="group transform-gpu bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Create Your Cards
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>

              <Link href="/search">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-4 text-lg font-semibold"
                >
                  Browse User Cards
                </Button>
              </Link>
            </div>

            {/* API Information */}
            <div className="mt-12 rounded-xl bg-white/60 p-6 backdrop-blur-sm dark:bg-gray-800/60">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {cardTypes.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Card Types Available
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {cardTypes.reduce(
                      (total, card) => total + card.variants.length,
                      0,
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Variations
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    100%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Live API Examples
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
