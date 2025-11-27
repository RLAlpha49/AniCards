"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { trackExternalLinkClick } from "@/lib/utils/google-analytics";
import { usePageSEO } from "@/hooks/use-page-seo";
import {
  SimpleDiscordIcon,
  SimpleGithubIcon,
  SimpleAniListIcon,
} from "@/components/simple-icons";
import {
  Mail,
  MessageSquare,
  ArrowRight,
  Send,
  ExternalLink,
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
 * Metadata that powers each social link card in the grid.
 * @source
 */
const SOCIAL_LINKS = [
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
    description: "Chat with me directly for quick responses",
    gradient: "from-indigo-500 to-purple-500",
    bgLight: "bg-indigo-100 dark:bg-indigo-900/30",
    textColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
    description: "Check out my projects and contributions",
    gradient: "from-slate-600 to-slate-800",
    bgLight: "bg-slate-100 dark:bg-slate-800/50",
    textColor: "text-slate-700 dark:text-slate-300",
  },
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList",
    description: "See my anime & manga collection",
    gradient: "from-cyan-500 to-blue-500",
    bgLight: "bg-cyan-100 dark:bg-cyan-900/30",
    textColor: "text-cyan-600 dark:text-cyan-400",
  },
];

/**
 * Renders the contact page with SEO setup plus the social and email CTAs.
 * @source
 */
export default function ContactPage() {
  usePageSEO("contact");

  /**
   * Reports outbound social clicks for analytics.
   * @param platform - Platform identifier used by the tracker.
   * @source
   */
  const handleSocialLinkClick = (platform: string) => {
    trackExternalLinkClick(platform, "contact_page");
  };

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
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300">
                    <MessageSquare className="h-4 w-4" />
                    Let&apos;s Connect
                  </span>
                </motion.div>

                {/* Main heading */}
                <motion.h1
                  variants={itemVariants}
                  className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl"
                >
                  Get in{" "}
                  <span className="relative">
                    <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Touch
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
                  Have a question, suggestion, or just want to say hi? I&apos;d
                  love to hear from you. Choose your preferred way to reach out
                  below.
                </motion.p>
              </motion.div>
            </div>
          </section>

          {/* Contact Options Section */}
          <section className="relative w-full overflow-hidden pb-16 lg:pb-24">
            <div className="container relative mx-auto px-4">
              <div className="mx-auto max-w-5xl">
                {/* Social Links Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="mb-12"
                >
                  <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                      Social Platforms
                    </h2>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">
                      Connect with me on your favorite platform
                    </p>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-3">
                    {SOCIAL_LINKS.map((link, index) => (
                      <motion.div
                        key={link.name}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                      >
                        <Link
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleSocialLinkClick(link.name)}
                          className="group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 p-8 text-center shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/50 dark:bg-slate-800/80 dark:shadow-slate-900/50"
                        >
                          {/* Gradient background on hover */}
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                          />

                          <div className="relative">
                            <div
                              className={`mb-4 inline-flex rounded-2xl p-4 ${link.bgLight} transition-transform duration-300 group-hover:scale-110`}
                            >
                              <link.icon size={32} className={link.textColor} />
                            </div>

                            <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                              {link.label}
                            </h3>
                            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                              {link.description}
                            </p>

                            <span
                              className={`inline-flex items-center gap-1 text-sm font-medium ${link.textColor}`}
                            >
                              Connect
                              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Email CTA Section */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6 }}
                  className="mx-auto max-w-3xl"
                >
                  <div className="rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 p-8 text-center shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50 sm:p-12">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                      className="space-y-6"
                    >
                      <div className="mx-auto mb-6 inline-flex rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-5 shadow-lg shadow-purple-500/25">
                        <Mail className="h-8 w-8 text-white" />
                      </div>

                      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        Prefer Email?
                      </h2>

                      <p className="mx-auto max-w-lg text-slate-600 dark:text-slate-300">
                        Send me a message directly and I&apos;ll get back to you
                        as soon as possible. Great for detailed questions or
                        collaboration opportunities.
                      </p>

                      <Button
                        asChild
                        size="lg"
                        className="group h-14 min-w-[280px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
                      >
                        <Link
                          href="mailto:contact@alpha49.com"
                          onClick={() => handleSocialLinkClick("email")}
                        >
                          <Send className="mr-2 h-5 w-5" />
                          contact@alpha49.com
                          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>

                {/* GitHub Issues Note */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="mt-12 text-center"
                >
                  <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/50 bg-white/50 px-6 py-4 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-700">
                      <SimpleGithubIcon
                        size={20}
                        className="text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Found a bug or have a feature request?{" "}
                      <Link
                        href="https://github.com/RLAlpha49/AniCards/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleSocialLinkClick("github_issues")}
                        className="font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Open an issue on GitHub
                      </Link>
                    </p>
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
