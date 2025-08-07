"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  BarChart2,
  Users,
  BookOpen,
  Tag,
  Mic,
  Building2,
  User,
  BookType,
  Clock,
} from "lucide-react";
import { StatCardGenerator } from "@/components/stat-card-generator";
import { motion } from "framer-motion";
import type React from "react";
import {
  trackButtonClick,
  trackDialogOpen,
} from "@/lib/utils/google-analytics";

export default function HomePage() {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const handleGetStartedClick = () => {
    trackButtonClick("get_started", "homepage");
    trackDialogOpen("stat_card_generator");
    setIsGeneratorOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Animated header section with gradient text */}
      <header className="mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="mb-4 inline-block bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-5xl font-bold text-transparent">
            Welcome to Anicards
          </h1>
        </motion.div>
        <motion.p
          className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Discover insights about your anime and manga journey with personalized
          stat cards!
        </motion.p>
      </header>

      {/* Main call-to-action section */}
      <section className="mx-auto mb-16 max-w-3xl text-center">
        <motion.h2
          className="mb-4 text-3xl font-semibold"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          What is Anicards?
        </motion.h2>
        <motion.p
          className="mb-6 text-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Anicards is an app that transforms your Anilist data into beautiful,
          shareable stat cards. It provides a unique way to visualize your anime
          and manga consumption habits, preferences, and social activity.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Button
            size="lg"
            onClick={handleGetStartedClick}
            className="transform-gpu transition-transform duration-200 hover:scale-[1.02]"
            aria-label="Open stat card generator to create your AniList cards"
          >
            Get Started
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Features grid section */}
      <section className="mb-16">
        <h2 className="mb-8 text-center text-3xl font-semibold">Features</h2>
        <div className="flex flex-wrap justify-center gap-6">
          {[
            // Feature configuration array - easily modifiable to add/remove features
            {
              icon: BarChart2,
              title: "Comprehensive Stats",
              description:
                "View detailed statistics about your anime and manga, including watch time, episode count, etc.",
            },
            {
              icon: Users,
              title: "Social Insights",
              description:
                "Track your Anilist social activity, including followers, following, and engagement metrics.",
            },
            {
              icon: BookOpen,
              title: "Manga Analysis",
              description:
                "Dive deep into your manga reading habits with chapter and volume counts, mean scores, etc.",
            },
            {
              icon: Tag,
              title: "Genre & Tag Breakdown",
              description:
                "Discover your top anime and manga genres and tags to understand your preferences better",
            },
            {
              icon: Mic,
              title: "Voice Actor Highlights",
              description:
                "Find out which voice actors appear most frequently in your anime.",
            },
            {
              icon: Building2,
              title: "Studio Insights",
              description:
                "See which animation studios produce your most-watched anime.",
            },
            {
              icon: Clock,
              title: "Daily Updates",
              description:
                "Your stats are automatically updated every day at least once.",
            },
            {
              icon: User,
              title: "Staff Spotlight",
              description:
                "Identify the directors, writers, and other staff members behind your anime.",
            },
            {
              icon: BookType,
              title: "Manga Creator Focus",
              description:
                "Explore the mangaka and staff responsible for your manga.",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              className="w-full md:w-[400px]"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring", // Spring animation for bouncy effect
                stiffness: 100, // Controls spring tension
                damping: 20, // Controls spring friction
                delay: 0.1 * index, // Staggered animation delay
              }}
              whileHover={{
                scale: 1.02, // Hover scale effect
                transition: { duration: 0.2 },
              }}
            >
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                className="transition-shadow duration-300 hover:shadow-lg"
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA section */}
      <section className="mx-auto max-w-3xl text-center">
        <motion.h2
          className="mb-6 text-3xl font-semibold"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.6 }}
        >
          Ready to see your anime and manga journey in a new light?
        </motion.h2>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-block"
        >
          <Button
            size="lg"
            onClick={handleGetStartedClick}
            className="transform-gpu transition-transform duration-200 hover:scale-[1.02]"
            aria-label="Create your AniList stat cards - open card generator"
          >
            Create Your Anicards
            <ChevronRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </motion.div>
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

// FeatureCard component props interface
interface FeatureCardProps {
  icon: React.ElementType; // Lucide React icon component
  title: string;
  description: string;
  className?: string;
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <motion.div whileHover={{ y: -5 }}>
      {" "}
      {/* Lift effect on hover */}
      <Card className={`${className || ""} group relative overflow-hidden`}>
        {/* Animated gradient overlay on hover */}
        <motion.div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <CardHeader>
          <motion.div
            className="inline-block"
            whileHover={{ rotate: 15, scale: 1.1 }} // Icon animation
            transition={{ type: "spring" }}
          >
            <Icon className="mb-2 h-10 w-10 text-primary transition-colors duration-300 group-hover:text-blue-600" />
          </motion.div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <motion.p
            className="text-gray-600 dark:text-gray-400"
            whileHover={{ color: "hsl(var(--foreground))" }} // Text color change on hover
          >
            {description}
          </motion.p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
