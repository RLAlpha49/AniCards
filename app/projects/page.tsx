"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePageSEO } from "@/hooks/use-page-seo";
import { SimpleGithubIcon } from "@/components/simple-icons";
import { ExternalLink, Sparkles, Code } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GridPattern } from "@/components/ui/grid-pattern";

/**
 * Renders the projects showcase page, including the hero, cards, and CTA flows.
 * @returns A fully composed project gallery view with CTA.
 * @source
 */
export default function ProjectsPage() {
  usePageSEO("projects");

  /**
   * Open-source project metadata used to render the grid cards.
   * @source
   */
  const projects = [
    {
      name: "Anilist Custom List Manager",
      description:
        "Manage your custom lists on Anilist and automatically set your entries to them based on conditions you set.",
      url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
      tags: ["Anilist", "List Management", "Open Source"],
    },
    {
      name: "Kenmai to Anilist",
      description:
        "A simple application to update your Anilist entries from a Kenmai export file.",
      url: "https://github.com/RLAlpha49/KenmeiToAnilist",
      tags: ["Anilist", "Kenmai", "Data Migration", "Open Source"],
    },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <GridPattern className="z-0" includeGradients={true} />

      <div className="container relative z-10 mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Code className="mr-2 h-4 w-4" />
            <span>Open Source</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
          >
            My Other{" "}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Projects
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
          >
            Explore my collection of open-source tools designed to enhance your
            anime and media tracking experience.
          </motion.p>
        </div>

        {/* Projects Grid */}
        <div className="mx-auto mb-24 grid max-w-5xl gap-8 md:grid-cols-2">
          {projects.map((project, index) => (
            <motion.div
              key={project.url}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
            >
              <Card className="group relative h-full overflow-hidden border-slate-200 bg-white/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                <CardContent className="relative flex h-full flex-col p-8">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                      <SimpleGithubIcon
                        size={32}
                        className="text-slate-900 dark:text-white"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="rounded-full text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${project.name} on GitHub`}
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    </Button>
                  </div>

                  <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                    {project.name}
                  </h3>

                  <p className="mb-6 flex-grow text-slate-600 dark:text-slate-400">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-12 shadow-2xl dark:from-blue-950 dark:via-slate-900 dark:to-purple-950">
            {/* Decorative background elements */}
            <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative z-10">
              <div className="mb-6 flex justify-center">
                <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
                  <Sparkles className="h-6 w-6 text-yellow-400" />
                </div>
              </div>

              <h2 className="mb-4 text-3xl font-bold text-white">
                Want to Contribute?
              </h2>

              <p className="mb-8 text-lg text-slate-300">
                All projects are open to contributions! Feel free to report
                issues, suggest features, or submit pull requests.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
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
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-slate-700 bg-transparent px-8 text-base text-white hover:bg-slate-800 hover:text-white"
                >
                  <Link href="/">Back to AniCards</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
