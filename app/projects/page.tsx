"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePageSEO } from "@/hooks/use-page-seo";
import { SimpleGithubIcon } from "@/components/simple-icons";
import {
  ExternalLink,
  Code2,
  GitFork,
  ArrowRight,
  Play,
  Sparkles,
} from "lucide-react";
import { GridPattern } from "@/components/ui/grid-pattern";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Animation variants for staggered content reveal.
 * @source
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/**
 * Open-source project metadata used to render the grid cards.
 * @source
 */
const PROJECTS = [
  {
    name: "Anilist Custom List Manager",
    description:
      "Manage your custom lists on Anilist and automatically set your entries to them based on conditions you set. A powerful tool for organizing your anime and manga collections.",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
    tags: ["Anilist", "List Management", "Automation"],
    gradient: "from-blue-500 to-cyan-500",
    bgLight: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    name: "Kenmai to Anilist",
    description:
      "An application to update your Anilist entries from a Kenmai export file. Perfect for migrating your tracking data between platforms.",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
    tags: ["Anilist", "Kenmai", "Data Migration"],
    gradient: "from-purple-500 to-pink-500",
    bgLight: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
  },
];

/**
 * Highlights for the projects value proposition.
 * @source
 */
const HIGHLIGHTS = [
  {
    icon: Code2,
    title: "Open Source",
    description: "All projects are freely available on GitHub",
  },
  {
    icon: GitFork,
    title: "Fork & Contribute",
    description: "Feel free to fork, modify, and submit PRs",
  },
];

/**
 * Renders the projects showcase page, including the hero, cards, and CTA flows.
 * @returns A fully composed project gallery view with CTA.
 * @source
 */
export default function ProjectsPage() {
  usePageSEO("projects");

  return (
    <ErrorBoundary>
      <div className="relative w-full overflow-hidden">
        {/* Background effects matching home page */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-cyan-400/15 to-blue-400/15 blur-3xl" />
          <div className="absolute left-0 top-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/10 to-orange-500/10 blur-3xl" />
        </div>

        <GridPattern className="z-0" />

        <div className="relative z-10">
          {/* Hero Section */}
          <section className="relative w-full overflow-hidden py-20 lg:py-28">
            <div className="container relative z-10 mx-auto px-4">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mx-auto flex max-w-4xl flex-col items-center text-center"
              >
                {/* Badge */}
                <motion.div variants={itemVariants}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-purple-200/50 bg-purple-50/80 px-4 py-2 text-sm font-medium text-purple-700 shadow-sm backdrop-blur-sm dark:border-purple-700/50 dark:bg-purple-950/50 dark:text-purple-300">
                    <Code2 className="h-4 w-4" />
                    Open Source Projects
                  </span>
                </motion.div>

                {/* Main heading */}
                <motion.h1
                  variants={itemVariants}
                  className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl"
                >
                  My Other{" "}
                  <span className="relative">
                    <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Projects
                    </span>
                    <motion.span
                      className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </span>
                </motion.h1>

                {/* Subheading */}
                <motion.p
                  variants={itemVariants}
                  className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
                >
                  Explore my collection of open-source tools designed to enhance
                  your anime and media tracking experience. All projects are
                  free to use and open to contributions.
                </motion.p>

                {/* Highlights */}
                <motion.div
                  variants={itemVariants}
                  className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  {HIGHLIGHTS.map((highlight) => (
                    <div
                      key={highlight.title}
                      className="flex flex-col items-center rounded-2xl border border-slate-200/50 bg-white/80 p-5 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80"
                    >
                      <div className="mb-3 rounded-xl bg-blue-100 p-2.5 dark:bg-blue-900/30">
                        <highlight.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {highlight.title}
                      </h3>
                      <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-400">
                        {highlight.description}
                      </p>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* Projects Grid Section */}
          <section className="relative w-full overflow-hidden pb-16 lg:pb-24">
            <div className="container relative mx-auto px-4">
              <div className="mx-auto max-w-5xl">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="mb-12"
                >
                  <div className="mb-8 text-center">
                    <span className="inline-block rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      Featured Projects
                    </span>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-2">
                    {PROJECTS.map((project, index) => (
                      <motion.div
                        key={project.url}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.15, duration: 0.5 }}
                      >
                        <div className="group relative h-full overflow-hidden rounded-3xl border border-slate-200/50 bg-white/80 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/50 dark:bg-slate-800/80 dark:shadow-slate-900/50">
                          {/* Gradient background on hover */}
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                          />

                          <div className="relative p-8">
                            {/* Header */}
                            <div className="mb-6 flex items-start justify-between">
                              <div
                                className={`rounded-2xl p-4 ${project.bgLight} transition-transform duration-300 group-hover:scale-110`}
                              >
                                <SimpleGithubIcon
                                  size={28}
                                  className={project.textColor}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="rounded-full text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
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

                            {/* Content */}
                            <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                              {project.name}
                            </h3>

                            <p className="mb-6 leading-relaxed text-slate-600 dark:text-slate-400">
                              {project.description}
                            </p>

                            {/* Tags */}
                            <div className="mb-6 flex flex-wrap gap-2">
                              {project.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* View Button */}
                            <Button
                              asChild
                              className={`w-full rounded-full bg-gradient-to-r ${project.gradient} text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg`}
                            >
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2"
                              >
                                <SimpleGithubIcon size={18} />
                                View on GitHub
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* CTA Section */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6 }}
                  className="mx-auto max-w-4xl"
                >
                  <div className="rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 p-8 text-center shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50 sm:p-12 lg:p-16">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                      className="space-y-6"
                    >
                      {/* Badge */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                      >
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/50 bg-amber-50/80 px-4 py-2 text-sm font-medium text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-300">
                          <Sparkles className="h-4 w-4" />
                          Want to Contribute?
                        </span>
                      </motion.div>

                      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
                        All Projects Are{" "}
                        <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                          Open to Contributions
                        </span>
                      </h2>

                      <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                        Feel free to report issues, suggest features, or submit
                        pull requests. Your contributions help make these tools
                        better for everyone!
                      </p>

                      <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                        <Button
                          asChild
                          size="lg"
                          className="group h-14 min-w-[220px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
                        >
                          <a
                            href="https://github.com/RLAlpha49"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center"
                          >
                            <SimpleGithubIcon size={20} className="mr-2" />
                            Visit My GitHub
                            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                          </a>
                        </Button>

                        <Link href="/">
                          <Button
                            variant="outline"
                            size="lg"
                            className="h-14 min-w-[180px] rounded-full border-2 text-lg font-medium"
                          >
                            <Play className="mr-2 h-5 w-5 fill-current" />
                            Back to Home
                          </Button>
                        </Link>
                      </div>

                      <p className="pt-4 text-sm text-slate-500 dark:text-slate-400">
                        ⭐ Star the projects if you find them useful!
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}
