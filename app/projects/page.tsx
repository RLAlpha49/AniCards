"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePageSEO } from "@/hooks/use-page-seo";
import { SimpleGithubIcon } from "@/components/icons/simple-icons";

export default function ProjectsPage() {
  usePageSEO("projects");

  const projects = [
    {
      name: "Anilist Custom List Manager",
      description:
        "Manage your custom lists on Anilist and automatically set your entries to them based on conditions you set.",
      url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
      tags: ["Python", "AniList API", "Automation"],
    },
    {
      name: "Kenmai to Anilist",
      description:
        "A simple application to update your Anilist entries from a Kenmai export file.",
      url: "https://github.com/RLAlpha49/KenmeiToAnilist",
      tags: ["Python", "Data Migration", "AniList"],
    },
    {
      name: "Spotify Skip Tracker",
      description: "A simple application to track your Spotify skips.",
      url: "https://github.com/RLAlpha49/SpotifySkipTracker",
      tags: ["Python", "Spotify API", "Analytics"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            My Other Projects
          </h1>
          <p className="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            Explore my collection of open-source projects that help enhance your
            anime and media tracking experience.
          </p>
        </motion.div>

        {/* Projects Grid */}
        <div className="mb-16 grid gap-8 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1">
          {projects.map((project, index) => (
            <motion.div
              key={project.url}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="group relative"
            >
              <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-white/15 hover:shadow-2xl dark:border-gray-700/30 dark:bg-gray-800/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-4 flex items-center gap-3">
                      <SimpleGithubIcon
                        size={32}
                        className="text-gray-700 dark:text-gray-300"
                      />
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
                        {project.name}
                      </h2>
                    </div>

                    <p className="mb-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
                      {project.description}
                    </p>

                    <div className="mb-6 flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        asChild
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
                      >
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <SimpleGithubIcon size={20} />
                          View on GitHub
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center"
        >
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/20 md:p-12">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
              Want to Contribute?
            </h2>
            <p className="mb-8 text-lg text-gray-600 dark:text-gray-300">
              All projects are open to contributions! Feel free to report
              issues, suggest features, or submit pull requests.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
              >
                <a
                  href="https://github.com/RLAlpha49"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <SimpleGithubIcon size={20} />
                  Visit My GitHub
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/">Back to AniCards</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
