"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { StatCardGenerator } from "@/components/stat-card-generator";
import { GridPattern } from "@/components/ui/grid-pattern";
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
  ExternalLink,
  Sparkles,
  Search,
} from "lucide-react";
import {
  CARD_GROUPS,
  buildCardUrl,
  VARIATION_LABEL_MAP,
  DEFAULT_BASE_CARD_URL,
} from "@/lib/card-groups";
import { usePageSEO } from "@/hooks/use-page-seo";
import { Input } from "@/components/ui/input";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Represents a single card variant shown in the gallery.
 * @source
 */
interface CardVariant {
  name: string;
  url: string;
  description?: string;
}

/**
 * Describes a card type grouping, including layout details and variations.
 * @source
 */
interface CardType {
  title: string;
  description: string;
  variants: CardVariant[];
  category: "Main Stats" | "Anime Breakdowns" | "Manga Breakdowns";
  icon: React.ElementType;
  color: string;
}
/**
 * Lightweight metadata for card types before their variants are built.
 * @source
 */
type CardTypeMeta = Omit<CardType, "variants"> & { variants?: CardVariant[] };

/**
 * Renders a preview card with an image, metadata, and a generator CTA overlay.
 * @param props.variant - The selected card variation to display.
 * @param props.cardTypeTitle - The parent card type title shown beside the preview.
 * @param props.userId - AniList user identifier carried through for generator intents.
 * @param props.color - Accent color hint for future theming hooks.
 * @param props.onOpenGenerator - Callback triggered when the generator button is pressed.
 * @returns A card preview surface that opens the generator via the overlay button.
 * @source
 */
function ExampleCard({
  variant,
  cardTypeTitle,
  userId,
  color,
  onOpenGenerator,
}: Readonly<{
  variant: CardVariant;
  cardTypeTitle: string;
  userId: string;
  color: string;
  onOpenGenerator: () => void;
}>) {
  return (
    <Card className="group relative overflow-hidden border-0 bg-white/80 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-800/80">
      <CardContent className="p-0">
        <div className="relative flex items-center justify-center bg-slate-100/50 p-6 dark:bg-slate-900/50">
          <div className="relative w-full shadow-sm transition-transform duration-300 group-hover:scale-[1.02]">
            <ImageWithSkeleton
              src={variant.url}
              alt={`${cardTypeTitle} - ${variant.name}`}
              className="h-auto w-full rounded-lg"
            />
          </div>

          {/* Hover Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-all duration-300 group-hover:bg-slate-900/10 dark:group-hover:bg-slate-900/30">
            <Button
              onClick={onOpenGenerator}
              className="translate-y-4 opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
            >
              <Play className="mr-2 h-4 w-4" />
              Create This Card
            </Button>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 dark:text-white">
              {variant.name}
            </h4>
            <a
              href={variant.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 transition-colors hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {cardTypeTitle}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Returns the icon component associated with a card category.
 * @param category - Category label to resolve.
 * @returns The Lucide icon component representing the category.
 * @source
 */
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

/**
 * Maps a category label to its Tailwind background and text color classes.
 * @param category - Category key used in the gallery sections.
 * @returns Background and text color class pairs for the badge.
 * @source
 */
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

/**
 * Renders a motion-enhanced section of cards for a single category.
 * @param props.category - Human-readable category name to display.
 * @param props.categoryIndex - Zero-based order of the category used for animation staggering.
 * @param props.filteredCardTypes - Card types filtered by the current search query.
 * @param props.isFirstCategory - Whether this section is the first in the list, affecting animation timing.
 * @param props.onOpenGenerator - Callback that opens the card generator modal.
 * @param props.userId - AniList user ID forwarded to the cards.
 * @returns A section full of example cards or null when no matching types exist.
 * @source
 */
function CategorySection({
  category,
  categoryIndex,
  filteredCardTypes,
  isFirstCategory,
  onOpenGenerator,
  userId,
}: Readonly<{
  category: string;
  categoryIndex: number;
  filteredCardTypes: CardType[];
  isFirstCategory: boolean;
  onOpenGenerator: () => void;
  userId: string;
}>) {
  const categoryCards = filteredCardTypes.filter(
    (card) => card.category === category,
  );

  if (categoryCards.length === 0) return null;

  const CategoryIcon = getCategoryIcon(category);
  const categoryColors = getCategoryColor(category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isFirstCategory ? { opacity: 1, y: 0 } : undefined}
      whileInView={isFirstCategory ? undefined : { opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: 0.1,
      }}
      viewport={
        isFirstCategory
          ? undefined
          : {
              once: true,
              margin: "-10% 0px -10% 0px",
              amount: 0.01,
            }
      }
    >
      {/* Category Header */}
      <div className="mb-12 flex items-center space-x-4">
        <div className={`rounded-2xl ${categoryColors.bg} p-3`}>
          <CategoryIcon className={`h-8 w-8 ${categoryColors.text}`} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            {category}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Collection of {categoryCards.length} card types
          </p>
        </div>
      </div>

      {/* Cards for this Category */}
      <div className="space-y-16">
        {categoryCards.map((cardType, cardIndex) => (
          <motion.div
            key={cardType.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isFirstCategory ? { opacity: 1, y: 0 } : undefined}
            whileInView={isFirstCategory ? undefined : { opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: isFirstCategory ? 0.5 + cardIndex * 0.1 : cardIndex * 0.1,
            }}
            viewport={isFirstCategory ? undefined : { once: true }}
            className="space-y-6"
          >
            {/* Card Type Header */}
            <div className="flex items-center space-x-3 border-l-4 border-slate-200 pl-4 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {cardType.title}
              </h3>
              <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline-block">
                — {cardType.description}
              </span>
            </div>

            {/* Variants Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardType.variants.map((variant, variantIndex) => (
                <motion.div
                  key={variant.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={
                    isFirstCategory ? { opacity: 1, scale: 1 } : undefined
                  }
                  whileInView={
                    isFirstCategory ? undefined : { opacity: 1, scale: 1 }
                  }
                  transition={{
                    duration: 0.4,
                    delay: isFirstCategory
                      ? 0.7 + cardIndex * 0.1 + variantIndex * 0.05
                      : variantIndex * 0.05,
                  }}
                  viewport={isFirstCategory ? undefined : { once: true }}
                >
                  <ExampleCard
                    variant={variant}
                    cardTypeTitle={cardType.title}
                    userId={userId}
                    color={cardType.color}
                    onOpenGenerator={onOpenGenerator}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Displays the examples gallery with search, statistics, and generator CTA.
 * @returns The examples page layout composed of category sections and the generator modal.
 * @source
 */
export default function ExamplesPage() {
  usePageSEO("examples");
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Base URL reused when building preview card links.
   * @source
   */
  const BASE_URL = DEFAULT_BASE_CARD_URL;
  /**
   * AniList user ID demonstrated in the example gallery links.
   * @source
   */
  const USER_ID = "542244";

  /**
   * Core metadata describing the card types that can appear in the gallery.
   * @source
   */
  const cardTypeMetadata: CardTypeMeta[] = [
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

  /**
   * Builds the card types plus generated variants by reusing shared CARD_GROUPS data.
   * @source
   */
  const cardTypesWithGeneratedVariants: CardType[] = cardTypeMetadata.map(
    (ct) => {
      const group = CARD_GROUPS.find((g) => g.cardTitle === ct.title);
      if (!group) return { ...ct, variants: ct.variants ?? [] } as CardType;

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

      return { ...ct, variants } as CardType;
    },
  );

  /**
   * Ordered category labels used to render separate gallery sections.
   * @source
   */
  const categories = [
    "Main Stats",
    "Anime Breakdowns",
    "Manga Breakdowns",
  ] as const;

  /**
   * Filtered card types that match the current search query.
   * @source
   */
  const filteredCardTypes = cardTypesWithGeneratedVariants.filter(
    (card) =>
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description.toLowerCase().includes(searchQuery.toLowerCase()),
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
      <div className="relative min-h-[90vh] w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        <GridPattern
          className="z-0"
          includeGradients={true}
          gradientCount={9}
        />
        <div className="relative z-10">
          {/* Header Section */}
          <section className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="container relative z-10 mx-auto px-4 py-12">
              <div className="mx-auto max-w-6xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-8"
                >
                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <Link href="/">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="group text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                      </Button>
                    </Link>
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search cards..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-6 text-center sm:text-left">
                    <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gallery
                    </div>
                    <h1 className="text-4xl font-bold leading-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                      Explore All{" "}
                      <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Card Types
                      </span>
                    </h1>
                    <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300 lg:text-xl">
                      Browse our complete collection of statistical
                      visualizations. All examples are generated in real-time
                      using data from{" "}
                      <a
                        href="https://anilist.co/user/Alpha49"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        @Alpha49
                      </a>
                      {""}.
                    </p>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {categories.map((category) => {
                      const count = cardTypesWithGeneratedVariants.filter(
                        (card) => card.category === category,
                      ).length;
                      const Icon = getCategoryIcon(category);
                      const colors = getCategoryColor(category);

                      return (
                        <div
                          key={category}
                          className="rounded-xl border border-slate-200 bg-white/50 p-4 text-center backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50"
                        >
                          <div
                            className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${colors.bg}`}
                          >
                            <Icon className={`h-5 w-5 ${colors.text}`} />
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {count}
                          </div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {category}
                          </div>
                        </div>
                      );
                    })}
                    <div className="rounded-xl border border-slate-200 bg-white/50 p-4 text-center backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {cardTypesWithGeneratedVariants.reduce(
                          (total, card) => total + card.variants.length,
                          0,
                        )}
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Total Variants
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Card Showcase by Category */}
          <section className="relative overflow-hidden py-20">
            <div className="container relative z-10 mx-auto px-4">
              <div className="mx-auto max-w-7xl space-y-24">
                {categories.map((category, categoryIndex) => (
                  <CategorySection
                    key={category}
                    category={category}
                    categoryIndex={categoryIndex}
                    filteredCardTypes={filteredCardTypes}
                    isFirstCategory={categoryIndex === 0}
                    onOpenGenerator={() => setIsGeneratorOpen(true)}
                    userId={USER_ID}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="relative overflow-hidden border-t border-slate-200 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="container relative z-10 mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="mx-auto max-w-4xl space-y-8 text-center"
              >
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white lg:text-4xl">
                    Ready to create your own?
                  </h2>
                  <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                    These are live examples using real AniList data from user{" "}
                    <a
                      href="https://anilist.co/user/Alpha49"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      @Alpha49
                    </a>
                    {""}. Generate your personalized cards with your own AniList
                    statistics!
                  </p>
                </div>

                <div className="flex flex-col items-center space-y-4 sm:flex-row sm:justify-center sm:space-x-6 sm:space-y-0">
                  <Button
                    size="lg"
                    onClick={() => setIsGeneratorOpen(true)}
                    className="group h-14 min-w-[200px] rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
                  >
                    <Play className="mr-2 h-5 w-5 fill-current" />
                    Create Your Cards
                  </Button>

                  <Link href="/search">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 min-w-[200px] rounded-full border-2 text-lg font-semibold"
                    >
                      Browse User Cards
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>

          <StatCardGenerator
            isOpen={isGeneratorOpen}
            onClose={() => setIsGeneratorOpen(false)}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
