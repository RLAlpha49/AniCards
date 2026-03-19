/**
 * Examples gallery catalog and URL builder for the public preview page.
 *
 * This file keeps the editorial metadata for each showcased card close to the
 * shared `CARD_GROUPS` config so the preview URLs, category copy, and supported
 * variations stay in sync without hardcoding example links across components.
 */
"use client";

import {
  Activity,
  BarChart2,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Heart,
  LayoutGrid,
  Mic,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { CardType, CardVariant } from "@/components/examples";
import {
  CategoryNavigation,
  CategorySection,
  CTASection,
  ExamplesHeroSection,
  SearchFilterBar,
} from "@/components/examples";
import { usePageSEO } from "@/hooks/usePageSEO";
import type { CardUrlParams } from "@/lib/card-groups";
import {
  buildCardUrlWithParams,
  CARD_GROUPS,
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
  VARIATION_LABEL_MAP,
} from "@/lib/card-groups";
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
  {
    title: "Anime Statistics",
    description:
      "Complete overview of your anime watching journey with various layout options",
    category: "Core Stats",
    icon: BarChart2,
    color: "blue",
  },
  {
    title: "Manga Statistics",
    description:
      "Comprehensive manga reading statistics with different display formats",
    category: "Core Stats",
    icon: BookOpen,
    color: "pink",
  },
  {
    title: "Social Statistics",
    description: "Community engagement metrics and social activity overview",
    category: "Core Stats",
    icon: Users,
    color: "green",
  },
  {
    title: "Profile Overview",
    description:
      "Avatar, banner, and key profile totals in a clean overview card",
    category: "Core Stats",
    icon: Users,
    color: "teal",
  },
  {
    title: "Anime vs Manga Overview",
    description: "High-level overview comparing your anime and manga habits",
    category: "Core Stats",
    icon: BarChart2,
    color: "indigo",
  },

  {
    title: "Anime Genres",
    description:
      "Breakdown of your anime genre preferences with multiple visualization options",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Anime Tags",
    description: "Most common tags from your anime collection",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Voice Actors",
    description: "Most frequent voice actors in your anime collection",
    category: "Anime Deep Dive",
    icon: Mic,
    color: "orange",
  },
  {
    title: "Animation Studios",
    description: "Your favorite animation studios breakdown",
    category: "Anime Deep Dive",
    icon: Building2,
    color: "teal",
  },
  {
    title: "Studio Collaboration",
    description: "Most frequent studio collaborations in your collection",
    category: "Anime Deep Dive",
    icon: Building2,
    color: "cyan",
  },
  {
    title: "Anime Staff",
    description: "Most frequent staff members in your anime collection",
    category: "Anime Deep Dive",
    icon: Users,
    color: "cyan",
  },
  {
    title: "Anime Status Distribution",
    description:
      "Distribution of anime by watching status with optional status colors",
    category: "Anime Deep Dive",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Anime Format Distribution",
    description: "Breakdown by anime formats (TV, Movie, OVA, etc.)",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "violet",
  },
  {
    title: "Anime Source Material Distribution",
    description:
      "Breakdown of anime by source material (Manga, Original, Light Novel, etc.)",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "orange",
  },
  {
    title: "Anime Seasonal Preference",
    description:
      "Breakdown of anime releases by season (Winter/Spring/Summer/Fall)",
    category: "Anime Deep Dive",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Anime Country Distribution",
    description: "Anime by country of origin breakdown",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Anime Score Distribution",
    description: "Distribution of your anime ratings",
    category: "Anime Deep Dive",
    icon: TrendingUp,
    color: "amber",
  },
  {
    title: "Anime Year Distribution",
    description: "Distribution of anime by release year",
    category: "Anime Deep Dive",
    icon: TrendingUp,
    color: "lime",
  },
  {
    title: "Episode Length Preferences",
    description: "Breakdown of your preferred anime episode lengths",
    category: "Anime Deep Dive",
    icon: Clock,
    color: "blue",
  },
  {
    title: "Genre Synergy",
    description: "Top genre combinations in your anime collection",
    category: "Anime Deep Dive",
    icon: BarChart2,
    color: "indigo",
  },

  {
    title: "Manga Genres",
    description: "Breakdown of your manga genre preferences",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Manga Tags",
    description: "Most common tags from your manga collection",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Manga Staff",
    description: "Most frequent staff members in your manga collection",
    category: "Manga Deep Dive",
    icon: Users,
    color: "cyan",
  },
  {
    title: "Manga Status Distribution",
    description: "Distribution of manga by reading status",
    category: "Manga Deep Dive",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Manga Format Distribution",
    description: "Breakdown by manga formats (Manga, Novel, etc.)",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "violet",
  },
  {
    title: "Manga Country Distribution",
    description: "Manga by country of origin breakdown",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Manga Score Distribution",
    description: "Distribution of your manga ratings",
    category: "Manga Deep Dive",
    icon: TrendingUp,
    color: "amber",
  },
  {
    title: "Manga Year Distribution",
    description: "Distribution of manga by release year",
    category: "Manga Deep Dive",
    icon: TrendingUp,
    color: "lime",
  },

  {
    title: "Recent Activity Summary",
    description: "Sparkline and stats summarizing recent activity",
    category: "Activity & Engagement",
    icon: Activity,
    color: "amber",
  },
  {
    title: "Activity Streaks",
    description: "Current and longest streaks based on activity history",
    category: "Activity & Engagement",
    icon: Clock,
    color: "amber",
  },
  {
    title: "Top Activity Days",
    description: "Highlight the days with highest activity",
    category: "Activity & Engagement",
    icon: Activity,
    color: "amber",
  },
  {
    title: "Social Milestones",
    description: "Milestones and achievements based on your social activity",
    category: "Activity & Engagement",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Review Statistics",
    description: "Overview of your review activity and ratings",
    category: "Activity & Engagement",
    icon: BarChart2,
    color: "blue",
  },
  {
    title: "Seasonal Viewing Patterns",
    description: "Patterns by day-of-week and month to show peak times",
    category: "Activity & Engagement",
    icon: Calendar,
    color: "amber",
  },

  {
    title: "Favourites Summary",
    description:
      "Quick summary of favourite anime, manga, and characters in one card",
    category: "Library & Progress",
    icon: Heart,
    color: "rose",
  },
  {
    title: "Favourites Grid",
    description:
      "Customisable grid showing favourite anime, manga, characters, or mixed",
    category: "Library & Progress",
    icon: LayoutGrid,
    color: "orange",
  },
  {
    title: "Status Completion Overview",
    description:
      "Compare anime vs manga completion totals with combined or split views",
    category: "Library & Progress",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Consumption Milestones",
    description: "Celebrate your biggest anime and manga milestones",
    category: "Library & Progress",
    icon: Calendar,
    color: "green",
  },
  {
    title: "Personal Records",
    description: "Your personal bests and standout completed titles",
    category: "Library & Progress",
    icon: BarChart2,
    color: "teal",
  },
  {
    title: "Planning Backlog",
    description: "Snapshot of your planned watch/read backlog",
    category: "Library & Progress",
    icon: Clock,
    color: "cyan",
  },
  {
    title: "Most Rewatched/Reread",
    description: "Your most revisited anime and manga",
    category: "Library & Progress",
    icon: Activity,
    color: "lime",
  },
  {
    title: "Currently Watching / Reading",
    description:
      "Snapshot of what you're currently watching/reading with anime-only and manga-only views",
    category: "Library & Progress",
    icon: Clock,
    color: "cyan",
  },
  {
    title: "Dropped Media",
    description: "Overview of titles you've dropped from your list",
    category: "Library & Progress",
    icon: Activity,
    color: "rose",
  },

  {
    title: "Anime vs Manga Score Comparison",
    description: "Compare your scoring patterns between anime and manga",
    category: "Advanced Analytics",
    icon: TrendingUp,
    color: "violet",
  },
  {
    title: "Country Diversity",
    description: "Compare the diversity of countries across anime and manga",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Genre Diversity",
    description: "Compare genre diversity across anime and manga",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Format Preference Overview",
    description: "Compare your format preferences between anime and manga",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "blue",
  },
  {
    title: "Release Era Preference",
    description: "Compare which release eras you consume most",
    category: "Advanced Analytics",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Start-Year Momentum",
    description: "Compare momentum by start year between anime and manga",
    category: "Advanced Analytics",
    icon: TrendingUp,
    color: "orange",
  },
  {
    title: "Length Preference",
    description: "Compare preferences for shorter vs longer series",
    category: "Advanced Analytics",
    icon: TrendingUp,
    color: "teal",
  },
  {
    title: "Tag Category Distribution",
    description: "Compare tag categories across anime and manga",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Tag Diversity",
    description: "Compare tag diversity across anime and manga",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "violet",
  },
];

const CATEGORIES = [
  "Core Stats",
  "Anime Deep Dive",
  "Manga Deep Dive",
  "Activity & Engagement",
  "Library & Progress",
  "Advanced Analytics",
] as const;

const BASE_URL = DEFAULT_BASE_CARD_URL;
const USER_ID = DEFAULT_EXAMPLE_USER_ID;

/**
 * Displays the examples gallery with search, filtering, and lightbox.
 * @returns The examples page layout composed of category sections and the generator modal.
 */
export default function ExamplesPage() {
  usePageSEO("examples");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const router = useRouter();

  const handleStartCreating = useCallback(() => {
    router.push("/search");
  }, [router]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleCategoryChange = useCallback((category: string | null) => {
    setActiveCategory(category);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory(null);
  }, []);

  const hasActiveFilters = searchQuery.length > 0 || activeCategory !== null;

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
    let filtered = cardTypesWithVariants;

    if (activeCategory) {
      filtered = filtered.filter((card) => card.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.description.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [cardTypesWithVariants, searchQuery, activeCategory]);

  const categoryInfo = useMemo(() => {
    return CATEGORIES.map((category) => ({
      name: category,
      count: cardTypesWithVariants.filter((c) => c.category === category)
        .length,
    }));
  }, [cardTypesWithVariants]);

  const totalCardTypes = cardTypesWithVariants.length;
  const totalVariants = useMemo(
    () => cardTypesWithVariants.reduce((sum, c) => sum + c.variants.length, 0),
    [cardTypesWithVariants],
  );

  return (
    <ErrorBoundary
      resetKeys={[searchQuery, activeCategory ?? ""]}
      onReset={() => {
        setSearchQuery("");
        setActiveCategory(null);
      }}
    >
      <div className="relative min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />

        <ExamplesHeroSection
          totalCardTypes={totalCardTypes}
          totalVariants={totalVariants}
          categoryCount={CATEGORIES.length}
          onStartCreating={handleStartCreating}
        />

        <div className="gold-line-thick mx-auto max-w-[50%]" />

        <div className="sticky top-15 z-30 mx-auto mt-5 max-w-7xl backdrop-blur-sm">
          <div className="border-gold/10 mx-auto max-w-7xl border px-4 pt-4 pb-0">
            <div className="mb-3">
              <SearchFilterBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                resultCount={filteredCardTypes.length}
                totalCount={totalCardTypes}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
              />
            </div>
            <CategoryNavigation
              categories={categoryInfo}
              activeCategory={activeCategory}
              onCategoryClick={handleCategoryChange}
            />
          </div>
        </div>

        <section id="card-gallery" className="relative w-full py-14 lg:py-20">
          <div className="relative container mx-auto px-4">
            <div className="mx-auto max-w-7xl space-y-20">
              {activeCategory ? (
                <CategorySection
                  key={activeCategory}
                  category={activeCategory}
                  cardTypes={filteredCardTypes}
                  isFirstCategory={true}
                />
              ) : (
                CATEGORIES.reduce<React.ReactNode[]>(
                  (nodes, category, categoryIndex) => {
                    const categoryCardTypes = filteredCardTypes.filter(
                      (card) => card.category === category,
                    );
                    if (categoryCardTypes.length === 0) return nodes;

                    if (nodes.length > 0) {
                      nodes.push(
                        <div
                          key={`divider-${category}`}
                          className="gold-line mx-auto max-w-xs"
                        />,
                      );
                    }

                    nodes.push(
                      <CategorySection
                        key={category}
                        category={category}
                        cardTypes={categoryCardTypes}
                        isFirstCategory={categoryIndex === 0}
                      />,
                    );
                    return nodes;
                  },
                  [],
                )
              )}

              {filteredCardTypes.length === 0 && (
                <div className="py-24 text-center">
                  <p className="font-display text-foreground/30 mb-2 text-lg tracking-wider">
                    NO RESULTS
                  </p>
                  <p className="font-body-serif text-foreground/40 text-sm">
                    No cards match your current filters.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-gold mt-6 text-sm font-medium hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <CTASection onStartCreating={handleStartCreating} />
      </div>
    </ErrorBoundary>
  );
}
