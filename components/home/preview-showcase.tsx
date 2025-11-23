"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { Play, ArrowRight } from "lucide-react";
import Link from "next/link";

interface PreviewShowcaseProps {
  onGetStarted: () => void;
}

const PREVIEW_CARDS = [
  {
    title: "Anime Statistics",
    description: "Complete overview of your anime watching journey",
    cardType: "animeStats",
    variation: "default",
    category: "Main Stats",
    color: "blue",
    size: "large",
  },
  {
    title: "Genre Distribution",
    description: "Beautiful pie chart of your favorite genres",
    cardType: "animeGenres",
    variation: "pie",
    category: "Analysis",
    color: "purple",
    size: "medium",
  },
  {
    title: "Social Activity",
    description: "Community engagement and social metrics",
    cardType: "socialStats",
    variation: "default",
    category: "Social",
    color: "green",
    size: "medium",
  },
  {
    title: "Voice Actors",
    description: "Most frequent voice actors in your anime",
    cardType: "animeVoiceActors",
    variation: "default",
    category: "Deep Dive",
    color: "orange",
    size: "medium",
  },
  {
    title: "Score Distribution",
    description: "How you rate anime with detailed charts",
    cardType: "animeScoreDistribution",
    variation: "default",
    category: "Analysis",
    color: "indigo",
    size: "medium",
  },
  {
    title: "Manga Statistics",
    description: "Comprehensive manga reading statistics",
    cardType: "mangaStats",
    variation: "default",
    category: "Main Stats",
    color: "pink",
    size: "large",
  },
];

export function PreviewShowcase({
  onGetStarted,
}: Readonly<PreviewShowcaseProps>) {
  const BASE_URL = "https://anicards.alpha49.com/api/card.svg";
  const USER_ID = "542244";

  return (
    <section
      id="preview-showcase"
      className="relative w-full overflow-hidden bg-transparent py-24"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-4 text-3xl font-bold text-slate-900 dark:text-white lg:text-4xl"
            >
              Choose from <span className="text-blue-600">20+ Card Types</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
            >
              From basic stats to detailed breakdowns - visualize every aspect
              of your anime and manga journey.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PREVIEW_CARDS.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`group relative ${
                  card.size === "large" ? "md:col-span-2 lg:col-span-2" : ""
                }`}
              >
                <Card className="h-full overflow-hidden border-0 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-800">
                  <CardContent className="p-0">
                    <div className="relative flex items-center justify-center bg-slate-100 p-8 dark:bg-slate-900/50">
                      <ImageWithSkeleton
                        src={`${BASE_URL}?cardType=${card.cardType}&userId=${USER_ID}&variation=${card.variation}`}
                        alt={card.title}
                        className="h-auto w-full max-w-full rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-all duration-300 group-hover:bg-slate-900/10 dark:group-hover:bg-slate-900/30">
                        <Button
                          onClick={onGetStarted}
                          className="translate-y-4 opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Create This Card
                        </Button>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {card.title}
                        </h3>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          {card.category}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {card.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/examples">
              <Button
                variant="outline"
                size="lg"
                className="group border-2 text-lg font-semibold"
              >
                View All Examples
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
