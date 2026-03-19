"use client";

import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, GitFork, Star } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";
import { usePageSEO } from "@/hooks/usePageSEO";

interface Project {
  name: string;
  description: string;
  url: string;
  tags: string[];
  numeral: string;
  highlight: string;
}

const FEATURED_PROJECT: Project = {
  name: "AniCards",
  description:
    "Elegant stat cards generated from your AniList data. Beautiful designs, rich color themes, multiple layouts, and SVG perfection that displays flawlessly everywhere.",
  url: "https://github.com/RLAlpha49/AniCards",
  tags: ["Next.js", "AniList API", "SVG", "TypeScript"],
  numeral: "Ⅰ",
  highlight:
    "The flagship project — the very site you're browsing. A complete platform for generating, customizing, and sharing beautiful anime stat cards.",
};

const PROJECTS: Project[] = [
  {
    name: "Anilist Custom List Manager",
    description:
      "Manage your custom lists on Anilist and automatically set your entries to them based on conditions you set. A powerful tool for organizing your anime and manga collections.",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
    tags: ["Anilist", "List Management", "Automation"],
    numeral: "Ⅱ",
    highlight:
      "Automate your collection organization with rule-based list assignments.",
  },
  {
    name: "Kenmai to Anilist",
    description:
      "An application to update your Anilist entries from a Kenmai export file. Perfect for migrating your tracking data between platforms.",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
    tags: ["Anilist", "Kenmai", "Data Migration"],
    numeral: "Ⅲ",
    highlight: "Seamless data migration between tracking platforms.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 },
  },
};

export default function ProjectsPage() {
  usePageSEO("projects");

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />

      <section className="relative overflow-hidden px-6 pt-24 pb-16 text-center sm:px-12 md:pt-32 md:pb-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10"
        >
          <motion.div variants={itemVariants} className="gold-ornament mb-8">
            <span className="text-gold text-xl">❖</span>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-gold mb-6 text-xs tracking-[0.5em] uppercase sm:text-sm"
          >
            Open Source Portfolio
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="font-display text-foreground mx-auto mb-6 max-w-4xl text-4xl leading-[1.1] font-black sm:text-5xl md:text-6xl lg:text-7xl"
          >
            CRAFTED WITH
            <br />
            <span className="text-gold">PURPOSE</span>
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="gold-line-thick mx-auto mb-6 max-w-25"
          />

          <motion.p
            variants={itemVariants}
            className="font-body-serif text-foreground/55 mx-auto mb-10 max-w-xl text-base leading-relaxed sm:text-lg"
          >
            A collection of open-source tools built to enhance your anime and
            media tracking experience. Each project is free, maintained, and
            open to contributions.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="text-foreground/40 flex flex-wrap items-center justify-center gap-6 text-xs tracking-wider uppercase"
          >
            <span>✦ Open Source</span>
            <span>✦ Community Driven</span>
            <span>✦ Free Forever</span>
          </motion.div>
        </motion.div>
      </section>

      <div className="gold-line-thick mx-auto max-w-[60%]" />

      <section className="relative px-6 py-16 sm:px-12 md:py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <h2 className="font-display text-foreground mb-2 text-sm tracking-[0.25em] uppercase">
              Flagship Project
            </h2>
            <div className="gold-line mx-auto max-w-10" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="imperial-card group relative overflow-hidden p-0 transition-all duration-500 hover:-translate-y-1">
              <div className="pointer-events-none absolute top-0 right-0 select-none">
                <span className="font-display text-gold/4 block text-[12rem] leading-none sm:text-[16rem] md:text-[20rem]">
                  {FEATURED_PROJECT.numeral}
                </span>
              </div>

              <div className="relative z-10 grid gap-0 md:grid-cols-[1fr_auto]">
                <div className="p-8 sm:p-10 md:p-12">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="border-gold/30 bg-gold/5 border p-3">
                      <SimpleGithubIcon size={28} className="text-gold" />
                    </div>
                    <div>
                      <h3 className="font-display text-foreground text-lg tracking-[0.15em] uppercase sm:text-xl">
                        {FEATURED_PROJECT.name}
                      </h3>
                      <p className="text-gold/70 text-xs tracking-[0.3em] uppercase">
                        This very site
                      </p>
                    </div>
                  </div>

                  <div className="gold-line mb-6 max-w-12" />

                  <p className="font-body-serif text-foreground/60 mb-4 max-w-lg text-sm leading-relaxed sm:text-base">
                    {FEATURED_PROJECT.highlight}
                  </p>
                  <p className="font-body-serif text-foreground/45 mb-8 max-w-lg text-sm leading-relaxed">
                    {FEATURED_PROJECT.description}
                  </p>

                  <div className="mb-8 flex flex-wrap gap-2">
                    {FEATURED_PROJECT.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border-gold/25 text-foreground/55 border px-3 py-1.5 text-xs tracking-wider uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button asChild className="imperial-btn imperial-btn-fill">
                      <a
                        href={FEATURED_PROJECT.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <Star className="h-4 w-4" />
                        Star on GitHub
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    </Button>
                    <Button asChild className="imperial-btn imperial-btn-ghost">
                      <Link
                        href="/examples"
                        className="flex items-center gap-2"
                      >
                        View Examples
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="border-gold/10 hidden items-center justify-center border-l px-12 md:flex">
                  <div className="text-center">
                    <span className="font-display text-gold/20 block text-7xl">
                      {FEATURED_PROJECT.numeral}
                    </span>
                    <div className="gold-line mx-auto mt-3 max-w-8" />
                    <p className="text-foreground/30 mt-3 text-xs tracking-[0.3em] uppercase">
                      Flagship
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="gold-line mx-auto max-w-[40%]" />

      <section className="relative px-6 py-16 sm:px-12 md:py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 className="font-display text-foreground mb-2 text-sm tracking-[0.25em] uppercase">
              The Collection
            </h2>
            <div className="gold-line mx-auto max-w-10" />
          </motion.div>

          <div className="relative">
            <div className="absolute top-0 bottom-0 left-1/2 hidden w-px -translate-x-1/2 bg-linear-to-b from-transparent via-[hsl(var(--gold)/0.2)] to-transparent md:block" />

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-20px" }}
              className="space-y-12 md:space-y-20"
            >
              {PROJECTS.map((project, index) => {
                const isLeft = index % 2 === 0;

                return (
                  <motion.div
                    key={project.url}
                    variants={itemVariants}
                    className="relative"
                  >
                    <div className="absolute top-10 left-1/2 z-10 hidden -translate-x-1/2 md:block">
                      <div className="border-gold/40 bg-background flex h-10 w-10 items-center justify-center border-2">
                        <span className="font-display text-gold text-sm">
                          {project.numeral}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`md:grid md:grid-cols-2 md:gap-16 ${
                        isLeft ? "" : "md:direction-rtl"
                      }`}
                    >
                      <div
                        className={`${isLeft ? "md:pr-8" : "md:col-start-2 md:pl-8"} md:direction-ltr`}
                      >
                        <div className="imperial-card group h-full transition-all duration-400 hover:-translate-y-1">
                          <div className="pointer-events-none absolute top-0 right-0 select-none">
                            <span className="font-display text-gold/4 block text-[8rem] leading-none">
                              {project.numeral}
                            </span>
                          </div>

                          <div className="relative z-10 p-8">
                            <div className="mb-5 flex items-start justify-between">
                              <div className="border-gold/20 border p-2.5">
                                <SimpleGithubIcon
                                  size={22}
                                  className="text-gold"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="text-foreground/40 hover:bg-gold/10 hover:text-gold transition-colors"
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

                            <h3 className="font-display text-foreground mb-2 text-sm tracking-[0.15em] uppercase sm:text-base">
                              {project.name}
                            </h3>
                            <div className="gold-line mb-4 max-w-8" />

                            <p className="font-body-serif text-foreground/55 mb-2 text-sm leading-relaxed italic">
                              {project.highlight}
                            </p>
                            <p className="font-body-serif text-foreground/45 mb-6 text-sm leading-relaxed">
                              {project.description}
                            </p>

                            <div className="mb-6 flex flex-wrap gap-2">
                              {project.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="border-gold/20 text-foreground/50 border px-3 py-1 text-xs tracking-wider uppercase"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <Button
                              asChild
                              className="imperial-btn imperial-btn-fill w-full"
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
                      </div>

                      <div className="hidden md:block" />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      <div className="gold-line-thick mx-auto max-w-[60%]" />

      <section className="px-6 py-16 sm:px-12 md:py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              num: "Ⅰ",
              title: "OPEN BY DEFAULT",
              desc: "Every project is open source. Fork, extend, and make it your own.",
            },
            {
              num: "Ⅱ",
              title: "BUILT FOR YOU",
              desc: "Tools designed around real workflows for anime and media tracking.",
            },
            {
              num: "Ⅲ",
              title: "ALWAYS EVOLVING",
              desc: "Actively maintained and improved. Contributions welcome from all.",
            },
          ].map((item) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.5 }}
              className="imperial-card text-center"
            >
              <span className="font-display text-gold mb-5 block text-4xl">
                {item.num}
              </span>
              <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.25em]">
                {item.title}
              </h3>
              <div className="gold-line mx-auto mb-3 max-w-10" />
              <p className="font-body-serif text-foreground/50 text-sm leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-gold/20 border-y-2 px-6 py-16 text-center sm:px-12 md:py-20">
        <div className="gold-ornament mb-6">
          <span className="text-gold text-base">❖</span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <h2 className="font-display text-gold mb-4 text-3xl sm:text-4xl">
            JOIN THE EFFORT
          </h2>
          <p className="font-body-serif text-foreground/40 mx-auto max-w-md text-sm leading-relaxed sm:text-base">
            Every star, issue, and pull request makes these tools better for the
            entire community.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <Button asChild className="imperial-btn imperial-btn-fill">
              <a
                href="https://github.com/RLAlpha49"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <SimpleGithubIcon size={20} />
                Visit My GitHub
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>

            <Button asChild className="imperial-btn imperial-btn-ghost">
              <Link href="/" className="flex items-center gap-2">
                <GitFork className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
