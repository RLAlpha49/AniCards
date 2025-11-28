"use client";

import { useState, useMemo, useCallback } from "react";
import { StatCardGenerator } from "@/components/stat-card-generator";
import { GridPattern } from "@/components/ui/grid-pattern";
import {
  BarChart2,
  Users,
  PieChart,
  TrendingUp,
  Mic,
  Building2,
  BookOpen,
} from "lucide-react";
import {
  CARD_GROUPS,
  buildCardUrl,
  VARIATION_LABEL_MAP,
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
} from "@/lib/card-groups";
import { usePageSEO } from "@/hooks/use-page-seo";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  ExamplesHeroSection,
  CategorySection,
  CTASection,
} from "@/components/examples";
import type { CardType, CardVariant } from "@/components/examples";

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
];

const CATEGORIES = [
  "Main Stats",
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

  const handleCloseGenerator = useCallback(() => {
    setIsGeneratorOpen(false);
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
        return {
          name: label,
          url: buildCardUrl(
            group.cardType,
            variation,
            extras,
            BASE_URL,
            USER_ID,
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
      <div className="relative w-full overflow-hidden">
        {/* Background effects matching home page */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-cyan-400/15 to-blue-400/15 blur-3xl" />
        </div>

        <GridPattern className="z-0" />

        <div className="relative z-10">
          {/* Hero Section */}
          <ExamplesHeroSection
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            stats={stats}
          />

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
            onClose={handleCloseGenerator}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
