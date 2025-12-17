"use client";

import { useState, useMemo, useCallback } from "react";
import PageShell from "@/components/PageShell";
import { StatCardGenerator } from "@/components/StatCardGenerator";
import {
  BarChart2,
  Users,
  PieChart,
  TrendingUp,
  Mic,
  Building2,
  BookOpen,
  Heart,
  LayoutGrid,
  Calendar,
  Clock,
  Activity,
} from "lucide-react";
import {
  CARD_GROUPS,
  buildCardUrlWithParams,
  VARIATION_LABEL_MAP,
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import type { CardUrlParams } from "@/lib/card-groups";
import { usePageSEO } from "@/hooks/usePageSEO";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  ExamplesHeroSection,
  CategorySection,
  CTASection,
} from "@/components/examples";
import type { CardType, CardVariant } from "@/components/examples";
import type { StoredCardConfig } from "@/lib/types/records";

/**
 * Card type gradients matching the category styling.
 */
const CARD_TYPE_GRADIENTS: Record<string, string> = {
  blue: "from-blue-500 to-cyan-500",
  pink: "from-pink-500 to-rose-500",
  green: "from-green-500 to-emerald-500",
  purple: "from-purple-500 to-violet-500",
  indigo: "from-indigo-500 to-blue-500",
  orange: "from-orange-500 to-amber-500",
  teal: "from-teal-500 to-cyan-500",
  cyan: "from-cyan-500 to-blue-500",
  emerald: "from-emerald-500 to-green-500",
  violet: "from-violet-500 to-purple-500",
  rose: "from-rose-500 to-pink-500",
  amber: "from-amber-500 to-orange-500",
  lime: "from-lime-500 to-green-500",
};

type CardTypeMeta = Omit<CardType, "variants" | "gradient"> & {
  variants?: CardVariant[];
};

/**
 * Core metadata describing the card types that can appear in the gallery.
 */
const CARD_TYPE_METADATA: CardTypeMeta[] = [
  // Main Stats
  {
    title: "Anime Statistics",
    description:
      "Complete overview of your anime watching journey with various layout options",
    category: "Main Stats",
    icon: BarChart2,
    color: "blue",
  },
  {
    title: "Manga Statistics",
    description:
      "Comprehensive manga reading statistics with different display formats",
    category: "Main Stats",
    icon: BookOpen,
    color: "pink",
  },
  {
    title: "Social Statistics",
    description: "Community engagement metrics and social activity overview",
    category: "Main Stats",
    icon: Users,
    color: "green",
  },

  // Profile & Favourites
  {
    title: "Profile Overview",
    description:
      "Avatar, banner, and key profile totals in a clean overview card",
    category: "Profile & Favourites",
    icon: Users,
    color: "teal",
  },
  {
    title: "Favourites Summary",
    description:
      "Quick summary of favourite anime, manga, and characters in one card",
    category: "Profile & Favourites",
    icon: Heart,
    color: "rose",
  },
  {
    title: "Favourites Grid",
    description:
      "Customisable grid showing favourite anime, manga, characters, or mixed",
    category: "Profile & Favourites",
    icon: LayoutGrid,
    color: "orange",
  },

  // Anime Breakdowns
  {
    title: "Anime Genres",
    description:
      "Breakdown of your anime genre preferences with multiple visualization options",
    category: "Anime Breakdowns",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Anime Tags",
    description: "Most common tags from your anime collection",
    category: "Anime Breakdowns",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Voice Actors",
    description: "Most frequent voice actors in your anime collection",
    category: "Anime Breakdowns",
    icon: Mic,
    color: "orange",
  },
  {
    title: "Animation Studios",
    description: "Your favorite animation studios breakdown",
    category: "Anime Breakdowns",
    icon: Building2,
    color: "teal",
  },
  {
    title: "Anime Staff",
    description: "Most frequent staff members in your anime collection",
    category: "Anime Breakdowns",
    icon: Users,
    color: "cyan",
  },
  {
    title: "Anime Status Distribution",
    description:
      "Distribution of anime by watching status with optional status colors",
    category: "Anime Breakdowns",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Anime Format Distribution",
    description: "Breakdown by anime formats (TV, Movie, OVA, etc.)",
    category: "Anime Breakdowns",
    icon: PieChart,
    color: "violet",
  },
  {
    title: "Anime Country Distribution",
    description: "Anime by country of origin breakdown",
    category: "Anime Breakdowns",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Anime Score Distribution",
    description: "Distribution of your anime ratings",
    category: "Anime Breakdowns",
    icon: TrendingUp,
    color: "amber",
  },
  {
    title: "Anime Year Distribution",
    description: "Distribution of anime by release year",
    category: "Anime Breakdowns",
    icon: TrendingUp,
    color: "lime",
  },

  // Manga Breakdowns
  {
    title: "Manga Genres",
    description: "Breakdown of your manga genre preferences",
    category: "Manga Breakdowns",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Manga Tags",
    description: "Most common tags from your manga collection",
    category: "Manga Breakdowns",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Manga Staff",
    description: "Most frequent staff members in your manga collection",
    category: "Manga Breakdowns",
    icon: Users,
    color: "cyan",
  },
  {
    title: "Manga Status Distribution",
    description: "Distribution of manga by reading status",
    category: "Manga Breakdowns",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Manga Format Distribution",
    description: "Breakdown by manga formats (Manga, Novel, etc.)",
    category: "Manga Breakdowns",
    icon: PieChart,
    color: "violet",
  },
  {
    title: "Manga Country Distribution",
    description: "Manga by country of origin breakdown",
    category: "Manga Breakdowns",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Manga Score Distribution",
    description: "Distribution of your manga ratings",
    category: "Manga Breakdowns",
    icon: TrendingUp,
    color: "amber",
  },
  {
    title: "Manga Year Distribution",
    description: "Distribution of manga by release year",
    category: "Manga Breakdowns",
    icon: TrendingUp,
    color: "lime",
  },

  // Activity & Time
  {
    title: "Activity Heatmap",
    description:
      "GitHub-style activity calendar showing daily activity intensity",
    category: "Activity & Time",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Recent Activity Summary",
    description: "Sparkline and stats summarizing recent activity",
    category: "Activity & Time",
    icon: Activity,
    color: "amber",
  },
  {
    title: "Recent Activity Feed",
    description: "List of recent activity events and counts",
    category: "Activity & Time",
    icon: Clock,
    color: "amber",
  },
  {
    title: "Activity Streaks",
    description: "Current and longest streaks based on activity history",
    category: "Activity & Time",
    icon: Clock,
    color: "amber",
  },
  {
    title: "Activity Patterns",
    description: "Patterns by day-of-week and month to show peak times",
    category: "Activity & Time",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Top Activity Days",
    description: "Highlight the days with highest activity",
    category: "Activity & Time",
    icon: Activity,
    color: "amber",
  },
];

const CATEGORIES = [
  "Main Stats",
  "Profile & Favourites",
  "Activity & Time",
  "Anime Breakdowns",
  "Manga Breakdowns",
] as const;

const BASE_URL = DEFAULT_BASE_CARD_URL;
const USER_ID = DEFAULT_EXAMPLE_USER_ID;

/**
 * Displays the examples gallery with search, statistics, and generator CTA.
 * @returns The examples page layout composed of category sections and the generator modal.
 */
export default function ExamplesPage() {
  usePageSEO("examples");
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenGenerator = useCallback(() => {
    setIsGeneratorOpen(true);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const cardTypesWithVariants = useMemo<CardType[]>(() => {
    return CARD_TYPE_METADATA.map((ct) => {
      const group = CARD_GROUPS.find((g) => g.cardTitle === ct.title);
      const gradient =
        CARD_TYPE_GRADIENTS[ct.color] || "from-blue-500 to-cyan-500";

      if (!group) {
        return { ...ct, variants: ct.variants ?? [], gradient } as CardType;
      }

      const variants = group.variations.map((v) => {
        const variation = typeof v === "string" ? v : v.variation;
        const extras = typeof v === "string" ? undefined : v.extras;
        const label = VARIATION_LABEL_MAP[variation] ?? variation;
        const extrasParams: Partial<CardUrlParams> = {
          colorPreset: "anilistDarkGradient",
        };
        if (extras) {
          for (const [key, value] of Object.entries(extras)) {
            switch (key) {
              case "statusColors":
                extrasParams.statusColors = value === "true";
                break;
              case "colorPreset":
                extrasParams.colorPreset = value;
                break;
              case "titleColor":
                extrasParams.titleColor = value;
                break;
              case "backgroundColor":
                extrasParams.backgroundColor = value;
                break;
              case "textColor":
                extrasParams.textColor = value;
                break;
              case "circleColor":
                extrasParams.circleColor = value;
                break;
              case "borderColor":
                extrasParams.borderColor = value;
                break;
              case "borderRadius":
                {
                  const parsed = Number.parseFloat(value);
                  if (!Number.isNaN(parsed)) extrasParams.borderRadius = parsed;
                }
                break;
              case "showFavorites":
                extrasParams.showFavorites = value === "true";
                break;
              case "piePercentages":
                extrasParams.piePercentages = value === "true";
                break;
              default:
                break;
            }
          }
        }

        const candidate: Partial<StoredCardConfig> = {
          cardName: group.cardType,
          variation,
          colorPreset: extrasParams.colorPreset,
          titleColor: extrasParams.titleColor,
          backgroundColor: extrasParams.backgroundColor,
          textColor: extrasParams.textColor,
          circleColor: extrasParams.circleColor,
          borderColor: extrasParams.borderColor,
          borderRadius: extrasParams.borderRadius,
          showFavorites: extrasParams.showFavorites,
          useStatusColors: extrasParams.statusColors,
          showPiePercentages: extrasParams.piePercentages,
        };
        return {
          name: label,
          url: buildCardUrlWithParams(
            mapStoredConfigToCardUrlParams(candidate, {
              userId: USER_ID,
              includeColors: false,
            }),
            BASE_URL,
          ),
        } as CardVariant;
      });

      return { ...ct, variants, gradient } as CardType;
    });
  }, []);

  const filteredCardTypes = useMemo(() => {
    if (!searchQuery.trim()) return cardTypesWithVariants;

    const query = searchQuery.toLowerCase();
    return cardTypesWithVariants.filter(
      (card) =>
        card.title.toLowerCase().includes(query) ||
        card.description.toLowerCase().includes(query),
    );
  }, [cardTypesWithVariants, searchQuery]);

  const stats = useMemo(
    () => ({
      mainStats: cardTypesWithVariants.filter(
        (c) => c.category === "Main Stats",
      ).length,
      profileFavourites: cardTypesWithVariants.filter(
        (c) => c.category === "Profile & Favourites",
      ).length,
      animeBreakdowns: cardTypesWithVariants.filter(
        (c) => c.category === "Anime Breakdowns",
      ).length,
      mangaBreakdowns: cardTypesWithVariants.filter(
        (c) => c.category === "Manga Breakdowns",
      ).length,
      totalVariants: cardTypesWithVariants.reduce(
        (sum, c) => sum + c.variants.length,
        0,
      ),
    }),
    [cardTypesWithVariants],
  );

  return (
    <ErrorBoundary
      resetKeys={[
        isGeneratorOpen ? "generator_open" : "generator_closed",
        searchQuery,
      ]}
      onReset={() => {
        setIsGeneratorOpen(false);
        setSearchQuery("");
      }}
    >
      <PageShell
        heroContent={
          <ExamplesHeroSection
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            stats={stats}
          />
        }
        heroContentClassName="w-full"
      >
        {/* Card Showcase by Category */}
        <section className="relative w-full overflow-hidden py-20 lg:py-28">
          <div className="container relative mx-auto px-4">
            <div className="mx-auto max-w-7xl space-y-24">
              {CATEGORIES.map((category, categoryIndex) => {
                const categoryCardTypes = filteredCardTypes.filter(
                  (card) => card.category === category,
                );
                return (
                  <CategorySection
                    key={category}
                    category={category}
                    cardTypes={categoryCardTypes}
                    onOpenGenerator={handleOpenGenerator}
                    isFirstCategory={categoryIndex === 0}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <CTASection onOpenGenerator={handleOpenGenerator} />

        <StatCardGenerator
          isOpen={isGeneratorOpen}
          onOpenChange={(open) => setIsGeneratorOpen(open)}
        />
      </PageShell>
    </ErrorBoundary>
  );
}
