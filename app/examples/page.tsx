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
import { useTheme } from "next-themes";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
      "A wide-angle snapshot of your anime watching habits — pick the layout that suits you",
    category: "Core Stats",
    icon: BarChart2,
    color: "blue",
  },
  {
    title: "Manga Statistics",
    description:
      "Your manga reading stats at a glance, available in several visual formats",
    category: "Core Stats",
    icon: BookOpen,
    color: "pink",
  },
  {
    title: "Social Statistics",
    description:
      "How you show up in the community — thread activity, follows, and everything social",
    category: "Core Stats",
    icon: Users,
    color: "green",
  },
  {
    title: "Profile Overview",
    description:
      "Your avatar, banner, and headline numbers wrapped into one tidy card",
    category: "Core Stats",
    icon: Users,
    color: "teal",
  },
  {
    title: "Anime vs Manga Overview",
    description: "Anime versus manga — a quick side-by-side of your two habits",
    category: "Core Stats",
    icon: BarChart2,
    color: "indigo",
  },

  {
    title: "Anime Genres",
    description:
      "Which genres pull you in? This maps your anime taste with several chart styles",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Anime Tags",
    description: "The tags that keep surfacing across your anime library",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Voice Actors",
    description:
      "Voice actors you've heard more than anyone else in your lineup",
    category: "Anime Deep Dive",
    icon: Mic,
    color: "orange",
  },
  {
    title: "Animation Studios",
    description: "A studio-by-studio breakdown of where your anime comes from",
    category: "Anime Deep Dive",
    icon: Building2,
    color: "teal",
  },
  {
    title: "Studio Collaboration",
    description: "Which studios team up most often in the shows you watch",
    category: "Anime Deep Dive",
    icon: Building2,
    color: "cyan",
  },
  {
    title: "Anime Staff",
    description:
      "The directors, writers, and key staff behind the anime you gravitate toward",
    category: "Anime Deep Dive",
    icon: Users,
    color: "cyan",
  },
  {
    title: "Anime Status Distribution",
    description:
      "Where things stand — watching, completed, dropped — with optional color coding",
    category: "Anime Deep Dive",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Anime Format Distribution",
    description:
      "TV series, movies, OVAs — see which formats dominate your watchlist",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "violet",
  },
  {
    title: "Anime Source Material Distribution",
    description:
      "Adapted from manga? An original? Light novel? See where your anime originated",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "orange",
  },
  {
    title: "Anime Seasonal Preference",
    description:
      "Winter premieres or summer blockbusters — find out which season owns your list",
    category: "Anime Deep Dive",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Anime Country Distribution",
    description:
      "Where in the world your anime was produced — country by country",
    category: "Anime Deep Dive",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Anime Score Distribution",
    description: "How your scores actually spread out across your anime list",
    category: "Anime Deep Dive",
    icon: TrendingUp,
    color: "amber",
  },
  {
    title: "Anime Year Distribution",
    description: "A timeline of when the anime on your list first aired",
    category: "Anime Deep Dive",
    icon: TrendingUp,
    color: "lime",
  },
  {
    title: "Episode Length Preferences",
    description:
      "Short-form bites or full-length episodes — see where your preferences land",
    category: "Anime Deep Dive",
    icon: Clock,
    color: "blue",
  },
  {
    title: "Genre Synergy",
    description:
      "The genre pairings that show up together most in your collection",
    category: "Anime Deep Dive",
    icon: BarChart2,
    color: "indigo",
  },

  {
    title: "Manga Genres",
    description: "Which manga genres keep pulling you back in",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Manga Tags",
    description: "Recurring tags scattered across your manga shelves",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Manga Staff",
    description:
      "The mangaka and staff who show up most across your reading list",
    category: "Manga Deep Dive",
    icon: Users,
    color: "cyan",
  },
  {
    title: "Manga Status Distribution",
    description:
      "Reading, finished, on hold — a snapshot of where each title sits",
    category: "Manga Deep Dive",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Manga Format Distribution",
    description:
      "Manga proper, light novels, one-shots — your format split at a glance",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "violet",
  },
  {
    title: "Manga Country Distribution",
    description: "Country of origin for every manga in your collection",
    category: "Manga Deep Dive",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Manga Score Distribution",
    description: "How generous (or harsh) your manga scores really are",
    category: "Manga Deep Dive",
    icon: TrendingUp,
    color: "amber",
  },
  {
    title: "Manga Year Distribution",
    description:
      "When the manga on your list was first published, year by year",
    category: "Manga Deep Dive",
    icon: TrendingUp,
    color: "lime",
  },

  {
    title: "Recent Activity Summary",
    description:
      "A quick pulse check — sparklines and numbers from your latest activity",
    category: "Activity & Engagement",
    icon: Activity,
    color: "amber",
  },
  {
    title: "Activity Streaks",
    description: "Your current streak and your all-time best, side by side",
    category: "Activity & Engagement",
    icon: Clock,
    color: "amber",
  },
  {
    title: "Top Activity Days",
    description: "The days you went hardest — ranked by raw activity volume",
    category: "Activity & Engagement",
    icon: Activity,
    color: "amber",
  },
  {
    title: "Social Milestones",
    description:
      "Unlocked milestones and social achievements worth bragging about",
    category: "Activity & Engagement",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Review Statistics",
    description:
      "How often you review, what you rate, and the scores you hand out",
    category: "Activity & Engagement",
    icon: BarChart2,
    color: "blue",
  },
  {
    title: "Seasonal Viewing Patterns",
    description:
      "When do you actually watch? Spot your peak days and busiest months",
    category: "Activity & Engagement",
    icon: Calendar,
    color: "amber",
  },

  {
    title: "Favourites Summary",
    description:
      "Your top picks — favourite anime, manga, and characters — all on a single card",
    category: "Library & Progress",
    icon: Heart,
    color: "rose",
  },
  {
    title: "Favourites Grid",
    description:
      "A flexible grid of favourites you can mix and match however you like",
    category: "Library & Progress",
    icon: LayoutGrid,
    color: "orange",
  },
  {
    title: "Status Completion Overview",
    description:
      "Completion tally for anime and manga — view them together or split apart",
    category: "Library & Progress",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Consumption Milestones",
    description:
      "The big landmarks in your anime and manga journey, worth celebrating",
    category: "Library & Progress",
    icon: Calendar,
    color: "green",
  },
  {
    title: "Personal Records",
    description: "Personal bests and the standout titles that earned them",
    category: "Library & Progress",
    icon: BarChart2,
    color: "teal",
  },
  {
    title: "Planning Backlog",
    description:
      "Everything still sitting in your plan-to-watch and plan-to-read pile",
    category: "Library & Progress",
    icon: Clock,
    color: "cyan",
  },
  {
    title: "Most Rewatched/Reread",
    description:
      "The titles you keep coming back to — your most rewatched and reread",
    category: "Library & Progress",
    icon: Activity,
    color: "lime",
  },
  {
    title: "Currently Watching / Reading",
    description:
      "What's on your plate right now, with options to filter by anime or manga only",
    category: "Library & Progress",
    icon: Clock,
    color: "cyan",
  },
  {
    title: "Dropped Media",
    description:
      "The ones that didn't make the cut — every title you've walked away from",
    category: "Library & Progress",
    icon: Activity,
    color: "rose",
  },

  {
    title: "Anime vs Manga Score Comparison",
    description:
      "Do you score anime and manga the same way? This card settles the debate",
    category: "Advanced Analytics",
    icon: TrendingUp,
    color: "violet",
  },
  {
    title: "Country Diversity",
    description: "How worldly is your taste? Country diversity, anime vs manga",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "rose",
  },
  {
    title: "Genre Diversity",
    description:
      "Genre spread across both media — are you more adventurous with one than the other?",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "purple",
  },
  {
    title: "Format Preference Overview",
    description:
      "TV vs manga proper, movies vs one-shots — your format leanings compared",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "blue",
  },
  {
    title: "Release Era Preference",
    description:
      "Classic era fan or modern-day devotee? See where most of your picks land",
    category: "Advanced Analytics",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Start-Year Momentum",
    description:
      "When did you start picking up new titles? Track the momentum year by year",
    category: "Advanced Analytics",
    icon: TrendingUp,
    color: "orange",
  },
  {
    title: "Length Preference",
    description:
      "Quick reads and binge-watches vs sprawling epics — see which side wins",
    category: "Advanced Analytics",
    icon: TrendingUp,
    color: "teal",
  },
  {
    title: "Tag Category Distribution",
    description:
      "How your tag preferences stack up when you put anime and manga next to each other",
    category: "Advanced Analytics",
    icon: PieChart,
    color: "indigo",
  },
  {
    title: "Tag Diversity",
    description:
      "Are your anime tags all over the map while manga stays niche? Find out",
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
  const [isMounted, setIsMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const colorPreset =
    isMounted && resolvedTheme === "dark"
      ? "anicardsDarkGradient"
      : "anicardsLightGradient";

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
          colorPreset,
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
  }, [colorPreset]);

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

        {/* Ornamental divider between hero and content */}
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="gold-line max-w-24 flex-1" />
          <div className="h-1 w-1 rotate-45 bg-[hsl(var(--gold)/0.3)]" />
          <div className="gold-line-thick max-w-32 flex-1" />
          <div className="h-1 w-1 rotate-45 bg-[hsl(var(--gold)/0.3)]" />
          <div className="gold-line max-w-24 flex-1" />
        </div>

        {/* Sticky filter toolbar */}
        <div className="sticky top-15 z-30 mx-auto mt-6 max-w-7xl px-4">
          <div className="border-gold/8 bg-background/85 border backdrop-blur-xl">
            <div className="px-5 pt-4 pb-0">
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
        </div>

        {/* Gallery */}
        <section id="card-gallery" className="relative w-full py-20 lg:py-24">
          {/* Subtle side accents */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-32 -left-32 h-96 w-64 rounded-full bg-[hsl(var(--gold)/0.02)] blur-[100px]" />
            <div className="absolute top-1/2 -right-32 h-96 w-64 rounded-full bg-[hsl(var(--gold)/0.02)] blur-[100px]" />
          </div>

          <div className="relative container mx-auto px-4">
            <div className="mx-auto max-w-7xl space-y-28">
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
                          className="flex items-center justify-center gap-3"
                        >
                          <div className="gold-line max-w-16 flex-1" />
                          <div className="h-1 w-1 rotate-45 border border-[hsl(var(--gold)/0.25)]" />
                          <div className="gold-line max-w-16 flex-1" />
                        </div>,
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
                <div className="py-32 text-center">
                  <div className="font-display text-foreground/6 mb-4 text-7xl font-black select-none sm:text-8xl">
                    ∅
                  </div>
                  <p className="font-display text-foreground/20 mb-2 text-base tracking-[0.25em] uppercase">
                    Nothing Here
                  </p>
                  <p className="font-body-serif text-foreground/30 mx-auto max-w-xs text-sm leading-relaxed">
                    Your filters came up empty. Try loosening the search or
                    picking a different category.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-gold hover:text-gold/80 mt-8 text-xs font-semibold tracking-widest uppercase transition-colors hover:underline"
                  >
                    Start fresh
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
